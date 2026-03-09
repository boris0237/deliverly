import { NextResponse } from 'next/server';
import { CompanyModel, DeliveryModel, PartnerModel, UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

type DeliveryStatus = 'pending' | 'assigned' | 'pickedUp' | 'inTransit' | 'delivered' | 'failed' | 'cancelled';

const ACTIVE_STATUSES: DeliveryStatus[] = ['pending', 'assigned', 'pickedUp', 'inTransit'];

function computeEtaMinutes(status: string) {
  if (status === 'inTransit') return 15;
  if (status === 'pickedUp') return 25;
  if (status === 'assigned') return 40;
  return 55;
}

function computeCenter(points: Array<{ lat: number; lng: number }>) {
  if (!points.length) return { lat: 3.848, lng: 11.5021 };
  const total = points.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: total.lat / points.length, lng: total.lng / points.length };
}

function buildFallbackPoint(base: { lat: number; lng: number }, index: number) {
  const angle = (index * 47 * Math.PI) / 180;
  const radius = 0.006 + (index % 3) * 0.0025;
  return {
    lat: base.lat + Math.sin(angle) * radius,
    lng: base.lng + Math.cos(angle) * radius,
  };
}

export async function GET(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const actor = await UserModel.findOne({ id: currentUserId }).lean();
    if (!actor?.companyId) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }
    const company = await CompanyModel.findOne({ id: actor.companyId }).lean();
    if (!company) {
      return NextResponse.json({ error: 'Company not found', code: 'COMPANY_NOT_FOUND' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || '12') || 12));
    const search = (searchParams.get('search') || '').trim();
    const driverIdFilter = (searchParams.get('driverId') || '').trim();
    const statusRaw = (searchParams.get('status') || 'active').trim();
    const dateFromRaw = (searchParams.get('dateFrom') || '').trim();
    const dateToRaw = (searchParams.get('dateTo') || '').trim();

    const requestedStatuses: DeliveryStatus[] =
      statusRaw === 'all'
        ? []
        : statusRaw === 'active'
        ? ACTIVE_STATUSES
        : [statusRaw as DeliveryStatus].filter((value) =>
            ['pending', 'assigned', 'pickedUp', 'inTransit', 'delivered', 'failed', 'cancelled'].includes(value)
          ) as DeliveryStatus[];

    const query: Record<string, unknown> = { companyId: company.id };
    if (requestedStatuses.length > 0) {
      query.status = { $in: requestedStatuses };
    }

    const dateRange: Record<string, Date> = {};
    if (dateFromRaw) {
      const fromDate = new Date(dateFromRaw);
      if (!Number.isNaN(fromDate.getTime())) {
        fromDate.setHours(0, 0, 0, 0);
        dateRange.$gte = fromDate;
      }
    }
    if (dateToRaw) {
      const toDate = new Date(dateToRaw);
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        dateRange.$lte = toDate;
      }
    }
    if (dateRange.$gte || dateRange.$lte) {
      query.deliveryDate = dateRange;
    }

    if (actor.role === 'driver') {
      query.$or = [{ driverId: actor.id }, { driverId: '' }, { driverId: null }, { driverId: { $exists: false } }];
    } else if (driverIdFilter) {
      query.driverId = driverIdFilter;
    }

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchFilters = [{ id: searchRegex }, { customerName: searchRegex }, { customerPhone: searchRegex }, { address: searchRegex }];
      if (Array.isArray(query.$and)) {
        (query.$and as Array<Record<string, unknown>>).push({ $or: searchFilters });
      } else {
        query.$and = [{ $or: searchFilters }];
      }
    }

    const [drivers, total, deliveries] = await Promise.all([
      UserModel.find({
        companyId: company.id,
        role: 'driver',
        ...(actor.role === 'driver' ? { id: actor.id } : {}),
      })
        .select({ _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, vehicleId: 1, isActive: 1, currentLocation: 1 })
        .lean(),
      DeliveryModel.countDocuments(query),
      DeliveryModel.find(query)
        .sort({ deliveryDate: 1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const partnerIds = Array.from(new Set(deliveries.map((delivery) => String(delivery.partnerId || '')).filter(Boolean)));
    const driverIds = Array.from(new Set(deliveries.map((delivery) => String(delivery.driverId || '')).filter(Boolean)));
    const partners = await PartnerModel.find({ companyId: company.id, id: { $in: partnerIds } }).select({ _id: 0, id: 1, name: 1 }).lean();
    const partnerById = new Map(partners.map((partner) => [partner.id, partner.name]));
    const driverById = new Map(
      drivers.map((driver) => [
        driver.id,
        `${String(driver.firstName || '').trim()} ${String(driver.lastName || '').trim()}`.trim() || driver.id,
      ])
    );
    const vehicleById = new Map(
      (company?.vehicles || []).map((vehicle: any) => [
        String(vehicle?.id || ''),
        {
          label: `${String(vehicle?.name || '')} (${String(vehicle?.plateNumber || '')})`,
          type: String(vehicle?.type || '').trim() || 'default',
        },
      ])
    );
    const neighborhoodsById = new Map<
      string,
      {
        name: string;
        address: string;
        latitude: number;
        longitude: number;
      }
    >();
    for (const zone of (company?.deliveryPricing?.zone?.zones || []) as Array<any>) {
      for (const neighborhood of (zone?.neighborhoods || []) as Array<any>) {
        const id = String(neighborhood?.id || '').trim();
        if (!id) continue;
        neighborhoodsById.set(id, {
          name: String(neighborhood?.name || ''),
          address: String(neighborhood?.address || ''),
          latitude: Number(neighborhood?.latitude || 0),
          longitude: Number(neighborhood?.longitude || 0),
        });
      }
    }

    const deliveriesByDriver = new Map<string, number>();
    let unassignedDeliveries = 0;
    let activeDeliveries = 0;
    let etaTotal = 0;
    let etaCount = 0;
    const statusBuckets: Record<string, number> = {
      pending: 0,
      assigned: 0,
      pickedUp: 0,
      inTransit: 0,
      delivered: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const delivery of deliveries) {
      const status = String(delivery.status || 'pending');
      statusBuckets[status] = (statusBuckets[status] || 0) + 1;
      if (ACTIVE_STATUSES.includes(status as DeliveryStatus)) {
        activeDeliveries += 1;
        etaTotal += computeEtaMinutes(status);
        etaCount += 1;
      }
      const driverId = String(delivery.driverId || '');
      if (driverId) {
        deliveriesByDriver.set(driverId, Number(deliveriesByDriver.get(driverId) || 0) + 1);
      } else {
        unassignedDeliveries += 1;
      }
    }

    const mappedDeliveries = deliveries.map((delivery) => {
      const status = String(delivery.status || 'pending');
      const deliveryDriverId = String(delivery.driverId || '');
      const neighborhood = neighborhoodsById.get(String(delivery.neighborhoodId || '').trim());
      const latitude = Number(neighborhood?.latitude || 0);
      const longitude = Number(neighborhood?.longitude || 0);
      return {
        id: delivery.id,
        partnerId: String(delivery.partnerId || ''),
        partnerName: partnerById.get(String(delivery.partnerId || '')) || '-',
        driverId: deliveryDriverId,
        driverName: driverById.get(deliveryDriverId) || '',
        customerName: String(delivery.customerName || ''),
        customerPhone: String(delivery.customerPhone || ''),
        address: String(delivery.address || ''),
        status,
        deliveryDate: delivery.deliveryDate,
        orderValue: Number(delivery.orderValue || 0),
        deliveryFee: Number(delivery.deliveryFee || 0),
        etaMinutes: ACTIVE_STATUSES.includes(status as DeliveryStatus) ? computeEtaMinutes(status) : 0,
        neighborhoodName: neighborhood?.name || '',
        latitude: Number.isFinite(latitude) && latitude !== 0 ? latitude : null,
        longitude: Number.isFinite(longitude) && longitude !== 0 ? longitude : null,
      };
    });

    const driverRows = drivers.map((driver) => {
      const assignedCount = Number(deliveriesByDriver.get(driver.id) || 0);
      const inTransitCount = mappedDeliveries.filter(
        (delivery) => String(delivery.driverId || '') === driver.id && String(delivery.status || '') === 'inTransit'
      ).length;
      return {
        id: driver.id,
        name: driverById.get(driver.id) || driver.id,
        phone: String(driver.phone || ''),
        vehicleLabel: vehicleById.get(String(driver.vehicleId || ''))?.label || '',
        vehicleType: vehicleById.get(String(driver.vehicleId || ''))?.type || 'default',
        isActive: driver.isActive !== false,
        activeDeliveries: assignedCount,
        inTransitDeliveries: inTransitCount,
        status: driver.isActive === false ? 'offline' : assignedCount > 0 ? 'busy' : 'available',
      };
    });

    const busyDrivers = driverRows.filter((driver) => driver.status === 'busy').length;
    const availableDrivers = driverRows.filter((driver) => driver.status === 'available').length;

    const deliveryPoints = mappedDeliveries
      .filter((delivery) => typeof delivery.latitude === 'number' && typeof delivery.longitude === 'number')
      .map((delivery) => ({
        id: delivery.id,
        status: delivery.status,
        lat: Number(delivery.latitude),
        lng: Number(delivery.longitude),
        label: delivery.address || delivery.neighborhoodName || delivery.id,
        driverId: delivery.driverId,
        driverName: delivery.driverName,
      }));
    const deliveryPointByDriverId = new Map<string, { lat: number; lng: number }>();
    for (const point of deliveryPoints) {
      if (point.driverId && !deliveryPointByDriverId.has(point.driverId)) {
        deliveryPointByDriverId.set(point.driverId, { lat: point.lat, lng: point.lng });
      }
    }
    const knownPointCenter = computeCenter(deliveryPoints.map((point) => ({ lat: point.lat, lng: point.lng })));
    const driverPoints = driverRows
      .map((driver) => {
        const liveLatitude = Number((driver as any)?.currentLocation?.latitude || 0);
        const liveLongitude = Number((driver as any)?.currentLocation?.longitude || 0);
        const hasLivePoint =
          Number.isFinite(liveLatitude) &&
          Number.isFinite(liveLongitude) &&
          liveLatitude !== 0 &&
          liveLongitude !== 0;
        const point = hasLivePoint ? { lat: liveLatitude, lng: liveLongitude } : deliveryPointByDriverId.get(driver.id);
        const fallback = buildFallbackPoint(knownPointCenter, driverRows.findIndex((candidate) => candidate.id === driver.id));
        const finalPoint = point || fallback;
        return {
          id: driver.id,
          name: driver.name,
          status: driver.status,
          activeDeliveries: driver.activeDeliveries,
          vehicleType: driver.vehicleType || 'default',
          lat: finalPoint.lat,
          lng: finalPoint.lng,
        };
      })
      .filter(Boolean);
    const center = computeCenter([...deliveryPoints.map((point) => ({ lat: point.lat, lng: point.lng })), ...driverPoints.map((point) => ({ lat: point!.lat, lng: point!.lng }))]);

    return NextResponse.json({
      summary: {
        activeDrivers: driverRows.filter((driver) => driver.isActive).length,
        busyDrivers,
        availableDrivers,
        activeDeliveries,
        unassignedDeliveries,
        avgEtaMinutes: etaCount > 0 ? Math.round(etaTotal / etaCount) : 0,
      },
      statusBuckets,
      drivers: driverRows,
      deliveries: mappedDeliveries,
      filters: {
        drivers: driverRows.map((driver) => ({ id: driver.id, label: driver.name })),
      },
      map: {
        center,
        deliveryPoints,
        driverPoints,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      meta: {
        role: String(actor.role || ''),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tracking', code: 'TRACKING_FETCH_FAILED' },
      { status: 500 }
    );
  }
}
