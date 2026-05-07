import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Camera, Lock, Mail, Save, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, useUIStore } from '@/store';
import { getLocalizedApiError } from '@/lib/auth/error-message';
import { fallbackAvatarUrl, getAvatarUrl } from '@/lib/avatar';

type ProfilePayload = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar: string;
  role: string;
  companyId: string;
  companyName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
};

const ProfilePage = () => {
  const { t } = useTranslation();
  const { showToast } = useUIStore();
  const { user, updateUser } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const initials = useMemo(() => {
    const left = String(firstName || profile?.firstName || user?.firstName || '').trim();
    const right = String(lastName || profile?.lastName || user?.lastName || '').trim();
    return `${left.charAt(0)}${right.charAt(0)}`.toUpperCase() || 'U';
  }, [firstName, lastName, profile?.firstName, profile?.lastName, user?.firstName, user?.lastName]);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dashboard/profile', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      const incoming = data?.profile as ProfilePayload;
      setProfile(incoming);
      setFirstName(String(incoming?.firstName || ''));
      setLastName(String(incoming?.lastName || ''));
      setPhone(String(incoming?.phone || ''));
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showToast(t('dashboard.profile.validation.required'), 'error');
      return;
    }
    if ((newPassword || confirmPassword || currentPassword) && newPassword !== confirmPassword) {
      showToast(t('dashboard.profile.validation.passwordMismatch'), 'error');
      return;
    }

    setIsSaving(true);
    try {
      let response: Response;
      if (selectedAvatarFile) {
        const payload = new FormData();
        payload.append('firstName', firstName.trim());
        payload.append('lastName', lastName.trim());
        payload.append('phone', (phone || '').trim());
        if (newPassword.trim()) {
          payload.append('currentPassword', currentPassword);
          payload.append('newPassword', newPassword);
        }
        payload.append('avatarFile', selectedAvatarFile);
        response = await fetch('/api/dashboard/profile', {
          method: 'PUT',
          body: payload,
        });
      } else {
        const body: Record<string, unknown> = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: (phone || '').trim(),
        };
        if (newPassword.trim()) {
          body.currentPassword = currentPassword;
          body.newPassword = newPassword;
        }
        response = await fetch('/api/dashboard/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      const data = await response.json();
      if (!response.ok) {
        showToast(getLocalizedApiError(t, data, response.status), 'error');
        return;
      }
      const updated = data?.profile as ProfilePayload;
      setProfile(updated);
      updateUser({
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        avatar: updated.avatar,
      });
      setSelectedAvatarFile(null);
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
        setAvatarPreviewUrl(null);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast(t('common.saved'), 'success');
    } catch {
      showToast(t('errors.network'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(t('dashboard.profile.validation.invalidAvatarFile'), 'error');
      return;
    }
    setSelectedAvatarFile(file);
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarPreviewUrl(URL.createObjectURL(file));
    showToast(t('dashboard.profile.avatarSelected'), 'info');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('dashboard.profile.title')}</h1>
        <p className="text-muted-foreground">{t('dashboard.profile.subtitle')}</p>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-purple-500 flex items-center justify-center text-white text-xl font-semibold overflow-hidden">
              {avatarPreviewUrl || profile?.avatar || user?.avatar ? (
                <img
                  src={avatarPreviewUrl || profile?.avatar || getAvatarUrl(user)}
                  alt={`${firstName || profile?.firstName || ''} ${lastName || profile?.lastName || ''}`}
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.src = fallbackAvatarUrl(profile?.email || user?.email);
                  }}
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
          </div>
          <div>
            <p className="text-xl font-semibold text-foreground">
              {firstName || profile?.firstName} {lastName || profile?.lastName}
            </p>
            <p className="text-sm text-muted-foreground">{profile?.email || user?.email}</p>
            <p className="text-xs text-muted-foreground">{t(`dashboard.users.roles.${profile?.role || user?.role}`)}</p>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{t('dashboard.profile.sections.personal')}</h2>
          {isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('dashboard.profile.fields.firstName')}</label>
              <input className="input-glass w-full" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('dashboard.profile.fields.lastName')}</label>
              <input className="input-glass w-full" value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">{t('dashboard.profile.fields.phone')}</label>
              <PhoneInput
                international
                defaultCountry="CM"
                className="input-glass"
                value={phone || undefined}
                onChange={(value) => setPhone(value || '')}
              />
            </div>
          </div>
        </div>

        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{t('dashboard.profile.sections.security')}</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('dashboard.profile.fields.currentPassword')}</label>
              <input
                type="password"
                className="input-glass w-full"
                value={currentPassword}
                placeholder={t('dashboard.profile.placeholders.currentPassword')}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('dashboard.profile.fields.newPassword')}</label>
              <input
                type="password"
                className="input-glass w-full"
                value={newPassword}
                placeholder={t('dashboard.profile.placeholders.newPassword')}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('dashboard.profile.fields.confirmPassword')}</label>
              <input
                type="password"
                className="input-glass w-full"
                value={confirmPassword}
                placeholder={t('dashboard.profile.placeholders.confirmPassword')}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">{t('dashboard.profile.sections.account')}</h2>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-border p-3 bg-card/70">
            <p className="text-xs text-muted-foreground mb-1">{t('dashboard.profile.fields.email')}</p>
            <p className="text-foreground inline-flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              {profile?.email || user?.email || '-'}
            </p>
          </div>
          <div className="rounded-xl border border-border p-3 bg-card/70">
            <p className="text-xs text-muted-foreground mb-1">{t('dashboard.profile.fields.company')}</p>
            <p className="text-foreground inline-flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-muted-foreground" />
              {profile?.companyName || '-'}
            </p>
          </div>
          <div className="rounded-xl border border-border p-3 bg-card/70">
            <p className="text-xs text-muted-foreground mb-1">{t('dashboard.profile.fields.role')}</p>
            <p className="text-foreground">{t(`dashboard.users.roles.${profile?.role || user?.role}`)}</p>
          </div>
          <div className="rounded-xl border border-border p-3 bg-card/70">
            <p className="text-xs text-muted-foreground mb-1">{t('dashboard.profile.fields.lastLogin')}</p>
            <p className="text-foreground">
              {profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : '-'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" className="btn-primary gap-2" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Lock className="w-4 h-4 animate-pulse" /> : <Save className="w-4 h-4" />}
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
};

export default ProfilePage;
