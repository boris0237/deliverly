type SupportedLocale = 'fr' | 'en';

type VerifyEmailTemplateInput = {
  firstName: string;
  verificationLink: string;
  locale: SupportedLocale;
};

type ResetPasswordTemplateInput = {
  firstName: string;
  resetLink: string;
  locale: SupportedLocale;
};

type ActionEmailCopy = {
  subject: string;
  preheader: string;
  securityTag: string;
  title: string;
  intro: string;
  cta: string;
  linkHelp: string;
  securityNote: string;
  footer: string;
  text: string;
};

type BillingNoticeTemplateInput = {
  companyName: string;
  planName: string;
  daysRemaining: number;
  endDate: string;
  billingLink: string;
  locale: SupportedLocale;
};

type CampaignTemplateInput = {
  locale: SupportedLocale;
  subject: string;
  preheader?: string;
  title?: string;
  greeting?: string;
  bodyHtml: string;
  footer?: string;
  tag?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildActionEmailHtml(params: {
  locale: SupportedLocale;
  subject: string;
  preheader: string;
  securityTag: string;
  title: string;
  greeting: string;
  intro: string;
  cta: string;
  actionLink: string;
  linkHelp: string;
  securityNote: string;
  footer: string;
}): string {
  const safeActionLink = escapeHtml(params.actionLink);

  return `
<!doctype html>
<html lang="${params.locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${params.subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${params.preheader}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;width:100%;">
            <tr>
              <td align="left" style="padding:0 0 14px 4px;font-size:13px;color:#6b7280;">
                Delivoo
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(17,24,39,0.08);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:28px 32px;background:linear-gradient(135deg,#0f172a 0%,#111827 100%);">
                      <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#f59e0b;font-weight:700;">
                        ${params.securityTag}
                      </div>
                      <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;color:#ffffff;">
                        ${params.title}
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:30px 32px 12px;">
                      <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#111827;">
                        ${params.greeting}
                      </p>
                      <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#374151;">
                        ${params.intro}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:4px 32px 8px;">
                      <a href="${safeActionLink}" style="display:inline-block;background:#f97316;border-radius:12px;padding:14px 28px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">
                        ${params.cta}
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 32px 10px;">
                      <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#6b7280;">
                        ${params.linkHelp}
                      </p>
                      <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;">
                        <a href="${safeActionLink}" style="color:#2563eb;text-decoration:underline;">${safeActionLink}</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:22px 32px 30px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
                        <tr>
                          <td style="padding:14px 16px;font-size:12px;line-height:1.6;color:#6b7280;">
                            ${params.securityNote}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 6px 0;font-size:12px;line-height:1.6;color:#9ca3af;">
                ${params.footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

export function buildCampaignTemplate(input: CampaignTemplateInput): string {
  const title = input.title?.trim() || input.subject.trim();
  const greeting =
    input.greeting?.trim() ||
    (input.locale === 'fr' ? 'Bonjour {name},' : 'Hi {name},');
  const preheader = input.preheader?.trim() || input.subject.trim();
  const tag = input.tag?.trim() || (input.locale === 'fr' ? 'Campagne' : 'Campaign');
  const footer =
    input.footer?.trim() ||
    (input.locale === 'fr'
      ? 'Delivoo, plateforme de gestion logistique.'
      : 'Delivoo, logistics management platform.');

  return `
<!doctype html>
<html lang="${input.locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(preheader)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;width:100%;">
            <tr>
              <td align="left" style="padding:0 0 14px 4px;font-size:13px;color:#6b7280;">
                Delivoo
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(17,24,39,0.08);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:28px 32px;background:linear-gradient(135deg,#0f172a 0%,#111827 100%);">
                      <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#f59e0b;font-weight:700;">
                        ${escapeHtml(tag)}
                      </div>
                      <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;color:#ffffff;">
                        ${escapeHtml(title)}
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:30px 32px 10px;">
                      <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#111827;">
                        ${escapeHtml(greeting)}
                      </p>
                      <div style="font-size:16px;line-height:1.7;color:#374151;">
                        ${input.bodyHtml}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 6px 0;font-size:12px;line-height:1.6;color:#9ca3af;">
                ${escapeHtml(footer)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

function buildVerifyCopy(input: VerifyEmailTemplateInput): ActionEmailCopy {
  return input.locale === 'fr'
    ? {
        subject: 'Confirmez votre compte Delivoo',
        preheader: 'Confirmez votre email pour activer votre espace Delivoo.',
        securityTag: 'Securite du compte',
        title: 'Confirmez votre email',
        intro: "Bienvenue sur Delivoo. Cliquez sur le bouton ci-dessous pour confirmer votre email et activer votre espace.",
        cta: 'Confirmer mon email',
        linkHelp: 'Le bouton ne fonctionne pas ? Copiez-collez ce lien dans votre navigateur :',
        securityNote: "Si vous n'avez pas cree de compte Delivoo, ignorez simplement cet email.",
        footer: 'Delivoo, plateforme de gestion logistique.',
        text: [
          `Bonjour ${input.firstName},`,
          '',
          'Bienvenue sur Delivoo.',
          'Confirmez votre email en ouvrant ce lien :',
          input.verificationLink,
          '',
          "Si vous n'etes pas a l'origine de cette inscription, ignorez cet email.",
        ].join('\n'),
      }
    : {
        subject: 'Confirm your Delivoo account',
        preheader: 'Confirm your email to activate your Delivoo workspace.',
        securityTag: 'Account Security',
        title: 'Confirm your email',
        intro: 'Welcome to Delivoo. Click the button below to confirm your email and activate your workspace.',
        cta: 'Confirm My Email',
        linkHelp: 'Button not working? Copy and paste this link into your browser:',
        securityNote: 'If you did not create a Delivoo account, you can safely ignore this email.',
        footer: 'Delivoo, logistics management platform.',
        text: [
          `Hi ${input.firstName},`,
          '',
          'Welcome to Delivoo.',
          'Please confirm your email address by opening this link:',
          input.verificationLink,
          '',
          'If you did not create this account, you can ignore this email.',
        ].join('\n'),
      };
}

function buildResetCopy(input: ResetPasswordTemplateInput): ActionEmailCopy {
  return input.locale === 'fr'
    ? {
        subject: 'Reinitialisez votre mot de passe Delivoo',
        preheader: 'Utilisez ce lien securise pour reinitialiser votre mot de passe Delivoo.',
        securityTag: 'Securite du compte',
        title: 'Reinitialisation du mot de passe',
        intro: 'Nous avons recu une demande de reinitialisation de mot de passe pour votre compte.',
        cta: 'Reinitialiser mon mot de passe',
        linkHelp: 'Le bouton ne fonctionne pas ? Copiez-collez ce lien dans votre navigateur :',
        securityNote: "Si vous n'etes pas a l'origine de cette demande, ignorez cet email et conservez votre mot de passe actuel.",
        footer: 'Delivoo, plateforme de gestion logistique.',
        text: [
          `Bonjour ${input.firstName},`,
          '',
          'Nous avons recu une demande de reinitialisation de mot de passe.',
          'Utilisez ce lien pour definir un nouveau mot de passe :',
          input.resetLink,
          '',
          "Si vous n'etes pas a l'origine de cette demande, ignorez cet email.",
        ].join('\n'),
      }
    : {
        subject: 'Reset your Delivoo password',
        preheader: 'Use this secure link to reset your Delivoo password.',
        securityTag: 'Account Security',
        title: 'Password reset request',
        intro: 'We received a request to reset the password for your account.',
        cta: 'Reset My Password',
        linkHelp: 'Button not working? Copy and paste this link into your browser:',
        securityNote: 'If you did not request this change, ignore this email and keep your current password.',
        footer: 'Delivoo, logistics management platform.',
        text: [
          `Hi ${input.firstName},`,
          '',
          'We received a request to reset your password.',
          'Use this link to create a new password:',
          input.resetLink,
          '',
          'If you did not request this, you can ignore this email.',
        ].join('\n'),
      };
}

export function buildBillingNoticeTemplate(input: BillingNoticeTemplateInput) {
  const copy =
    input.locale === 'fr'
      ? {
          subject: `Votre plan ${input.planName} arrive à échéance`,
          preheader: `Votre période se termine dans ${input.daysRemaining} jours.`,
          securityTag: 'Facturation',
          title: 'Renouvellement de votre plan',
          intro: `Bonjour ${input.companyName}, votre plan ${input.planName} se termine le ${input.endDate}.`,
          cta: 'Gérer ma facturation',
          linkHelp: 'Si le bouton ne fonctionne pas, utilisez ce lien :',
          securityNote: 'Pour éviter une interruption, mettez à jour votre plan dès maintenant.',
          footer: 'Delivoo, plateforme de gestion logistique.',
          text: [
            `Bonjour ${input.companyName},`,
            '',
            `Votre plan ${input.planName} arrive à échéance dans ${input.daysRemaining} jours.`,
            `Date de fin : ${input.endDate}`,
            '',
            `Gérer votre plan : ${input.billingLink}`,
          ].join('\n'),
        }
      : {
          subject: `Your ${input.planName} plan is ending soon`,
          preheader: `Your period ends in ${input.daysRemaining} days.`,
          securityTag: 'Billing',
          title: 'Plan renewal reminder',
          intro: `Hello ${input.companyName}, your ${input.planName} plan ends on ${input.endDate}.`,
          cta: 'Manage billing',
          linkHelp: 'Button not working? Use this link:',
          securityNote: 'Update your plan to avoid service interruption.',
          footer: 'Delivoo, logistics management platform.',
          text: [
            `Hello ${input.companyName},`,
            '',
            `Your ${input.planName} plan ends in ${input.daysRemaining} days.`,
            `End date: ${input.endDate}`,
            '',
            `Manage your plan: ${input.billingLink}`,
          ].join('\n'),
        };

  return {
    subject: copy.subject,
    text: copy.text,
    html: buildActionEmailHtml({
      locale: input.locale,
      subject: copy.subject,
      preheader: copy.preheader,
      securityTag: copy.securityTag,
      title: copy.title,
      greeting: copy.intro.split('.')[0] + '.',
      intro: copy.intro,
      cta: copy.cta,
      actionLink: input.billingLink,
      linkHelp: copy.linkHelp,
      securityNote: copy.securityNote,
      footer: copy.footer,
    }),
  };
}

export function buildVerifyEmailTemplate(input: VerifyEmailTemplateInput): {
  subject: string;
  text: string;
  html: string;
} {
  const copy = buildVerifyCopy(input);
  const safeFirstName = escapeHtml(input.firstName);
  const greeting = input.locale === 'fr' ? `Bonjour ${safeFirstName},` : `Hi ${safeFirstName},`;
  const html = buildActionEmailHtml({
    locale: input.locale,
    subject: copy.subject,
    preheader: copy.preheader,
    securityTag: copy.securityTag,
    title: copy.title,
    greeting,
    intro: copy.intro,
    cta: copy.cta,
    actionLink: input.verificationLink,
    linkHelp: copy.linkHelp,
    securityNote: copy.securityNote,
    footer: copy.footer,
  });

  return { subject: copy.subject, text: copy.text, html };
}

export function buildResetPasswordTemplate(input: ResetPasswordTemplateInput): {
  subject: string;
  text: string;
  html: string;
} {
  const copy = buildResetCopy(input);
  const safeFirstName = escapeHtml(input.firstName);
  const greeting = input.locale === 'fr' ? `Bonjour ${safeFirstName},` : `Hi ${safeFirstName},`;
  const html = buildActionEmailHtml({
    locale: input.locale,
    subject: copy.subject,
    preheader: copy.preheader,
    securityTag: copy.securityTag,
    title: copy.title,
    greeting,
    intro: copy.intro,
    cta: copy.cta,
    actionLink: input.resetLink,
    linkHelp: copy.linkHelp,
    securityNote: copy.securityNote,
    footer: copy.footer,
  });

  return { subject: copy.subject, text: copy.text, html };
}
