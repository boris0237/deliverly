import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  MoreVertical,
  Boxes,
  AlertTriangle,
  Package,
  TrendingDown,
  Upload,
  Save,
  History,
} from 'lucide-react';
import type { Partner, Product } from '@/types';
import { useInventoryStore, useUIStore } from '@/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getLocalizedApiError } from '@/lib/auth/error-message';

type CreateProductForm = {
  name: string;
  price: number;
  stockQuantity: number;
  partnerId: string;
};

type EditProductForm = {
  name: string;
  price: number;
  partnerId: string;
};

type StockMovementItem = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  type: 'entry' | 'exit' | 'transfer' | 'adjustment';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  performedBy: string;
  createdAt: string;
};

const DEFAULT_CREATE_FORM: CreateProductForm = {
  name: '',
  price: 0,
  stockQuantity: 0,
  partnerId: '',
};

const DEFAULT_EDIT_FORM: EditProductForm = {
  name: '',
  price: 0,
  partnerId: '',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  XAF: 'FCFA',
  XOF: 'CFA',
  NGN: '₦',
  GHS: 'GH₵',
  KES: 'KSh',
  UGX: 'USh',
  TZS: 'TSh',
  MAD: 'MAD',
  DZD: 'DZD',
  TND: 'TND',
  ZAR: 'R',
  USD: '$',
  EUR: '€',
};

const getCurrencySymbol = (currency: string) => CURRENCY_SYMBOLS[currency] || currency;

const InventoryPage = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useUIStore();
  const { products, setProducts } = useInventoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isMovingStock, setIsMovingStock] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerFilter, setPartnerFilter] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [refreshTick, setRefreshTick] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowStockPreview, setLowStockPreview] = useState<Product[]>([]);

  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [movementPage, setMovementPage] = useState(1);
  const [movementPageSize, setMovementPageSize] = useState(10);
  const [movementTotalItems, setMovementTotalItems] = useState(0);
  const [movementTotalPages, setMovementTotalPages] = useState(1);
  const [movementTypeFilter, setMovementTypeFilter] = useState<'all' | 'entry' | 'exit'>('all');
  const [isMovementsLoading, setIsMovementsLoading] = useState(true);

  const [createForm, setCreateForm] = useState<CreateProductForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditProductForm>(DEFAULT_EDIT_FORM);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<'entry' | 'exit'>('entry');
  const [movementQuantity, setMovementQuantity] = useState(1);
  const [movementReason, setMovementReason] = useState('');
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  const createImageInputRef = useRef<HTMLInputElement | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);

  const [createImageFile, setCreateImageFile] = useState<File | null>(null);
  const [createImagePreviewUrl, setCreateImagePreviewUrl] = useState<string | null>(null);

  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!createImageFile) {
      setCreateImagePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(createImageFile);
    setCreateImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [createImageFile]);

  useEffect(() => {
    if (!editImageFile) {
      setEditImagePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(editImageFile);
    setEditImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [editImageFile]);

  useEffect(() => {
    let mounted = true;

    const loadPartners = async () => {
      try {
        const response = await fetch('/api/dashboard/partners', { cache: 'no-store' });
        const data = await response.json();
        if (!mounted) return;

        if (!response.ok) {
          showToast(getLocalizedApiError(t, data, response.status), 'error');
          return;
        }

        setPartners(Array.isArray(data?.partners) ? data.partners : []);
      } catch {
        if (mounted) showToast(t('errors.network'), 'error');
      }
    };

    loadPartners();

    return () => {
      mounted = false;
    };
  }, [showToast, t]);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (partnerFilter) params.set('partnerId', partnerFilter);

      const response = await fetch(`/api/dashboard/inventory/products?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setProducts(Array.isArray(data?.products) ? data.products : []);
      setCurrency(data?.currency || 'XAF');
      setTotalItems(Number(data?.pagination?.total || 0));
      setTotalPages(Number(data?.pagination?.totalPages || 1));
      setLowStockCount(Number(data?.lowStock?.count || 0));
      setLowStockPreview(Array.isArray(data?.lowStock?.preview) ? data.lowStock.preview : []);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, partnerFilter, searchQuery, setProducts, showToast, t]);

  const loadMovements = useCallback(async () => {
    if (!historyProduct?.id) {
      setMovements([]);
      setMovementTotalItems(0);
      setMovementTotalPages(1);
      setIsMovementsLoading(false);
      return;
    }

    setIsMovementsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(movementPage));
      params.set('pageSize', String(movementPageSize));
      params.set('productId', historyProduct.id);
      if (movementTypeFilter !== 'all') params.set('type', movementTypeFilter);

      const response = await fetch(`/api/dashboard/inventory/movements?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      setMovements(Array.isArray(data?.movements) ? data.movements : []);
      setMovementTotalItems(Number(data?.pagination?.total || 0));
      setMovementTotalPages(Number(data?.pagination?.totalPages || 1));
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsMovementsLoading(false);
    }
  }, [historyProduct?.id, movementPage, movementPageSize, movementTypeFilter, showToast, t]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts, refreshTick]);

  useEffect(() => {
    if (!isHistoryDialogOpen) return;
    loadMovements();
  }, [isHistoryDialogOpen, loadMovements, refreshTick]);

  const partnerNameById = useMemo(() => new Map(partners.map((partner) => [partner.id, partner.name])), [partners]);

  const formatPrice = (amount: number) => {
    try {
      return new Intl.NumberFormat(i18n.language || 'fr', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${getCurrencySymbol(currency)}${amount.toFixed(2)}`;
    }
  };

  const formatDateTime = (value: string | Date) => {
    try {
      return new Intl.DateTimeFormat(i18n.language || 'fr', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value));
    } catch {
      return String(value);
    }
  };

  const formatMovementReason = (reason: string) => {
    if (!reason) return '-';
    const deliveryRefMatch = /(.*)\s#([a-zA-Z0-9]+)$/.exec(reason);
    const rawPrefix = (deliveryRefMatch?.[1] || reason).trim();
    const deliveryId = (deliveryRefMatch?.[2] || '').trim();

    const prefixMap: Record<string, string> = {
      DELIVERY_STOCK_DEDUCT: 'deliveryStockDeduct',
      DELIVERY_STOCK_RESTORE: 'deliveryStockRestore',
      DELIVERY_STOCK_ADJUST: 'deliveryStockAdjust',
      DELIVERY_STOCK_REVERT_DELETE: 'deliveryStockRevertDelete',
      'Delivery marked as delivered': 'deliveryStockDeduct',
      'Delivery removed from delivered': 'deliveryStockRestore',
      'Delivered items updated': 'deliveryStockAdjust',
      'Delivery deleted (revert stock)': 'deliveryStockRevertDelete',
    };

    const translationKey = prefixMap[rawPrefix];
    if (!translationKey) return reason;
    return t(`dashboard.inventory.history.reasonTemplates.${translationKey}`, { deliveryId: deliveryId || '-' });
  };

  const resetCreateForm = () => {
    setCreateForm(DEFAULT_CREATE_FORM);
    setCreateImageFile(null);
  };

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    setEditForm({
      name: product.name,
      price: product.price,
      partnerId: product.partnerId || '',
    });
    setEditImageFile(null);
    setIsEditDialogOpen(true);
  };

  const openMovementDialog = (product: Product, type: 'entry' | 'exit') => {
    setMovementProduct(product);
    setMovementType(type);
    setMovementQuantity(1);
    setMovementReason('');
    setIsMovementDialogOpen(true);
  };

  const openHistoryDialog = (product: Product) => {
    setHistoryProduct(product);
    setMovementTypeFilter('all');
    setMovementPage(1);
    setIsHistoryDialogOpen(true);
  };

  const handleCreateImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(t('dashboard.inventory.invalidImageFile'), 'error');
      event.target.value = '';
      return;
    }
    setCreateImageFile(file);
    showToast(t('dashboard.inventory.imageSelected'), 'info');
    event.target.value = '';
  };

  const handleEditImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(t('dashboard.inventory.invalidImageFile'), 'error');
      event.target.value = '';
      return;
    }
    setEditImageFile(file);
    showToast(t('dashboard.inventory.imageSelected'), 'info');
    event.target.value = '';
  };

  const handleCreateProduct = async () => {
    if (!createForm.name.trim()) {
      showToast(t('dashboard.inventory.nameRequired'), 'error');
      return;
    }

    setIsCreating(true);
    try {
      const payload = new FormData();
      payload.append('name', createForm.name);
      payload.append('price', String(createForm.price));
      payload.append('stockQuantity', String(createForm.stockQuantity));
      payload.append('partnerId', createForm.partnerId);
      if (createImageFile) payload.append('imageFile', createImageFile);

      const response = await fetch('/api/dashboard/inventory/products', {
        method: 'POST',
        body: payload,
      });

      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      showToast(data?.message || t('common.create'), 'success');
      setIsCreateDialogOpen(false);
      setPage(1);
      resetCreateForm();
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditProduct = async () => {
    if (!selectedProduct) return;
    if (!editForm.name.trim()) {
      showToast(t('dashboard.inventory.nameRequired'), 'error');
      return;
    }

    setIsEditing(true);
    try {
      const payload = new FormData();
      payload.append('name', editForm.name);
      payload.append('price', String(editForm.price));
      payload.append('partnerId', editForm.partnerId);
      if (editImageFile) payload.append('imageFile', editImageFile);

      const response = await fetch(`/api/dashboard/inventory/products/${selectedProduct.id}`, {
        method: 'PUT',
        body: payload,
      });

      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      showToast(data?.message || t('common.save'), 'success');
      setIsEditDialogOpen(false);
      setSelectedProduct(null);
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteProduct) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/dashboard/inventory/products/${deleteProduct.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      showToast(data?.message || t('common.delete'), 'success');
      setDeleteProduct(null);
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateMovement = async () => {
    if (!movementProduct) return;
    if (movementQuantity <= 0) {
      showToast(t('dashboard.inventory.movement.quantityRequired'), 'error');
      return;
    }

    setIsMovingStock(true);
    try {
      const response = await fetch('/api/dashboard/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: movementProduct.id,
          type: movementType,
          quantity: movementQuantity,
          reason: movementReason,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }

      showToast(data?.message || t('common.save'), 'success');
      setIsMovementDialogOpen(false);
      setMovementProduct(null);
      setRefreshTick((value) => value + 1);
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsMovingStock(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.inventory.title')}</h1>
          <p className="text-white/50">{t('dashboard.inventory.subtitle')}</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2">
              <Plus className="w-4 h-4" />
              {t('dashboard.inventory.create')}
            </Button>
          </DialogTrigger>

          <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">{t('dashboard.inventory.create')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.inventory.fields.name')}</label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder={t('dashboard.inventory.placeholders.name')}
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.inventory.fields.image')}</label>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                    {createImagePreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={createImagePreviewUrl} alt="Product" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-white/40" />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2"
                    onClick={() => createImageInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    {t('dashboard.inventory.uploadImage')}
                  </Button>
                  <input
                    ref={createImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCreateImageChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.inventory.fields.price')}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input-glass"
                    value={createForm.price}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, price: Number(e.target.value || 0) }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t('dashboard.inventory.fields.stockQuantity')}</label>
                  <input
                    type="number"
                    min={0}
                    className="input-glass"
                    value={createForm.stockQuantity}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, stockQuantity: Number(e.target.value || 0) }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.inventory.fields.partner')}</label>
                <select
                  className="input-glass"
                  value={createForm.partnerId}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, partnerId: e.target.value }))}
                >
                  <option value="">{t('dashboard.inventory.placeholders.partner')}</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button className="w-full btn-primary gap-2" onClick={handleCreateProduct} disabled={isCreating}>
                <Save className="w-4 h-4" />
                {isCreating ? t('common.loading') : t('common.create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{t('dashboard.inventory.edit')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.inventory.fields.name')}</label>
              <input
                type="text"
                className="input-glass"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.inventory.fields.image')}</label>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                  {editImagePreviewUrl || selectedProduct?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editImagePreviewUrl || selectedProduct?.image} alt="Product" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-6 h-6 text-white/40" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2"
                  onClick={() => editImageInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  {t('dashboard.inventory.uploadImage')}
                </Button>
                <input
                  ref={editImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleEditImageChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.inventory.fields.price')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input-glass"
                  value={editForm.price}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, price: Number(e.target.value || 0) }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">{t('dashboard.inventory.fields.partner')}</label>
                <select
                  className="input-glass"
                  value={editForm.partnerId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, partnerId: e.target.value }))}
                >
                  <option value="">{t('dashboard.inventory.placeholders.partner')}</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button className="w-full btn-primary gap-2" onClick={handleEditProduct} disabled={isEditing}>
              <Save className="w-4 h-4" />
              {isEditing ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {movementType === 'entry' ? t('dashboard.inventory.stock.entry') : t('dashboard.inventory.stock.exit')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="text-sm text-white/70">
              {movementProduct?.name} ({movementProduct?.sku})
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.inventory.movement.quantity')}</label>
              <input
                type="number"
                min={1}
                className="input-glass"
                value={movementQuantity}
                onChange={(e) => setMovementQuantity(Number(e.target.value || 1))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/70">{t('dashboard.inventory.movement.reason')}</label>
              <input
                type="text"
                className="input-glass"
                placeholder={t('dashboard.inventory.movement.reasonPlaceholder')}
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
              />
            </div>

            <Button className="w-full btn-primary gap-2" onClick={handleCreateMovement} disabled={isMovingStock}>
              <Save className="w-4 h-4" />
              {isMovingStock ? t('common.loading') : t('common.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="bg-card border-border w-[95vw] max-w-[95vw] sm:!max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <History className="w-4 h-4" />
              {t('dashboard.inventory.history.titleForProduct', {
                product: historyProduct?.name || '',
              })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-[180px_120px] gap-2">
              <select
                className="input-glass"
                value={movementTypeFilter}
                onChange={(e) => {
                  setMovementTypeFilter(e.target.value as 'all' | 'entry' | 'exit');
                  setMovementPage(1);
                }}
              >
                <option value="all">{t('dashboard.inventory.history.allTypes')}</option>
                <option value="entry">{t('dashboard.inventory.history.entry')}</option>
                <option value="exit">{t('dashboard.inventory.history.exit')}</option>
              </select>
              <select
                className="input-glass"
                value={movementPageSize}
                onChange={(e) => {
                  setMovementPageSize(Number(e.target.value));
                  setMovementPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-white/50 border-b border-white/5">
                    <th className="p-3 font-medium">{t('dashboard.inventory.history.date')}</th>
                    <th className="p-3 font-medium">{t('dashboard.inventory.history.type')}</th>
                    <th className="p-3 font-medium">{t('dashboard.inventory.history.quantity')}</th>
                    <th className="p-3 font-medium">{t('dashboard.inventory.history.previous')}</th>
                    <th className="p-3 font-medium">{t('dashboard.inventory.history.new')}</th>
                    <th className="p-3 font-medium">{t('dashboard.inventory.history.reason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id} className="border-b border-white/5">
                      <td className="p-3 text-sm text-white/70">{formatDateTime(movement.createdAt)}</td>
                      <td className="p-3 text-sm">
                        <span className={movement.type === 'entry' ? 'text-green-400' : 'text-red-400'}>
                          {movement.type === 'entry'
                            ? t('dashboard.inventory.history.entry')
                            : t('dashboard.inventory.history.exit')}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-white">{movement.quantity}</td>
                      <td className="p-3 text-sm text-white/70">{movement.previousStock}</td>
                      <td className="p-3 text-sm text-white/70">{movement.newStock}</td>
                      <td className="p-3 text-sm text-white/60">{formatMovementReason(movement.reason)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isMovementsLoading && movements.length === 0 && (
              <div className="text-sm text-white/50 text-center py-2">{t('dashboard.inventory.history.empty')}</div>
            )}

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-white/60">
                {t('dashboard.inventory.pagination.summary', {
                  from: movementTotalItems === 0 ? 0 : (movementPage - 1) * movementPageSize + 1,
                  to: Math.min(movementPage * movementPageSize, movementTotalItems),
                  total: movementTotalItems,
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  onClick={() => setMovementPage((p) => Math.max(1, p - 1))}
                  disabled={isMovementsLoading || movementPage <= 1}
                >
                  {t('dashboard.inventory.pagination.previous')}
                </Button>
                <div className="text-sm text-white/70 min-w-[80px] text-center">
                  {t('dashboard.inventory.pagination.page', { page: movementPage, totalPages: movementTotalPages })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  onClick={() => setMovementPage((p) => Math.min(movementTotalPages, p + 1))}
                  disabled={isMovementsLoading || movementPage >= movementTotalPages}
                >
                  {t('dashboard.inventory.pagination.next')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteProduct)} onOpenChange={(open) => !open && setDeleteProduct(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              {t('dashboard.inventory.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-white">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDeleteProduct}
              disabled={isDeleting}
            >
              {isDeleting ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lowStockCount > 0 && (
        <div className="glass-card p-4 border-yellow-500/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">{t('dashboard.inventory.alerts.title')}</h3>
              <p className="text-sm text-white/50">
                {t('dashboard.inventory.alerts.lowCount', { count: lowStockCount })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockPreview.map((product) => (
              <div key={product.id} className="px-3 py-2 bg-yellow-500/10 rounded-lg flex items-center gap-2">
                <Package className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-white">{product.name}</span>
                <span className="text-xs text-yellow-400">
                  {t('dashboard.inventory.alerts.remaining', { count: product.stockQuantity })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_260px]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="input-glass pl-12 w-full"
          />
        </div>
        <select
          className="input-glass"
          value={partnerFilter}
          onChange={(e) => {
            setPartnerFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('dashboard.inventory.filters.partnerAll')}</option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.name}
            </option>
          ))}
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-white/50 border-b border-white/5">
                <th className="p-4 font-medium">{t('dashboard.inventory.table.product')}</th>
                <th className="p-4 font-medium">{t('dashboard.inventory.table.sku')}</th>
                <th className="p-4 font-medium">{t('dashboard.inventory.table.stock')}</th>
                <th className="p-4 font-medium">{t('dashboard.inventory.table.price')}</th>
                <th className="p-4 font-medium">{t('dashboard.inventory.table.movement')}</th>
                <th className="p-4 font-medium text-right">{t('dashboard.inventory.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-white/40" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-white font-medium">{product.name}</div>
                        {product.partnerId && partnerNameById.get(product.partnerId) && (
                          <div className="text-xs text-white/50">{partnerNameById.get(product.partnerId)}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-white/70">{product.sku}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          product.stockQuantity <= product.minStockLevel ? 'text-yellow-400' : 'text-white'
                        }`}
                      >
                        {product.stockQuantity}
                      </span>
                      {product.stockQuantity <= product.minStockLevel && (
                        <TrendingDown className="w-4 h-4 text-yellow-400" />
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-white">
                    {new Intl.NumberFormat(i18n.language || 'fr', {
                      style: 'currency',
                      currency,
                      maximumFractionDigits: 2,
                    }).format(product.price)}
                  </td>
                  <td className="p-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white/5 border-white/10 hover:bg-white/10 text-white text-xs"
                      onClick={() => openHistoryDialog(product)}
                    >
                      {t('dashboard.inventory.history.viewMovement')}
                    </Button>
                  </td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white/50 hover:text-white hover:bg-white/10"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => openEditDialog(product)}>
                          {t('common.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => openMovementDialog(product, 'entry')}>
                          {t('dashboard.inventory.stock.entry')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => openMovementDialog(product, 'exit')}>
                          {t('dashboard.inventory.stock.exit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer text-red-400 hover:bg-red-500/10" onClick={() => setDeleteProduct(product)}>
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && products.length === 0 && (
          <div className="p-12 text-center">
            <Boxes className="w-12 h-12 mx-auto mb-4 text-white/20" />
            <p className="text-white/50">{t('dashboard.inventory.empty')}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-white/60">
          {t('dashboard.inventory.pagination.summary', {
            from: totalItems === 0 ? 0 : (page - 1) * pageSize + 1,
            to: Math.min(page * pageSize, totalItems),
            total: totalItems,
          })}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input-glass py-2 px-3 w-[90px]"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <Button
            type="button"
            variant="outline"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={isLoading || page <= 1}
          >
            {t('dashboard.inventory.pagination.previous')}
          </Button>
          <div className="text-sm text-white/70 min-w-[80px] text-center">
            {t('dashboard.inventory.pagination.page', { page, totalPages })}
          </div>
          <Button
            type="button"
            variant="outline"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={isLoading || page >= totalPages}
          >
            {t('dashboard.inventory.pagination.next')}
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-white/60">{t('common.loading')}</div>}
    </div>
  );
};

export default InventoryPage;
