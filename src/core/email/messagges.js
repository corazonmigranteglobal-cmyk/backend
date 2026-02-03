const APP_DEFAULT = "Corazón Migrante";

function hi(nombre) {
  return `Hola${nombre ? " " + nombre : ""},`;
}

function fmtLine(label, value) {
  if (!value) return "";
  return `\n${label}: ${value}`;
}

function wrapHtml(body) {
  return `
  <div style="font-family: Arial, sans-serif; line-height: 1.45; color:#111;">
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
    <p style="font-size:12px;color:#666;margin:0;">
      Si no reconoces este mensaje, ignóralo o responde a este correo.
    </p>
  </div>`;
}

function getTo(ctx) {
  return ctx?.to || ctx?.email || null;
}

function isoDate(v) {
  if (!v) return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function isoTime(v) {
  if (!v) return "";
  const s = String(v);
  return s.length >= 16 ? s.slice(11, 16) : s;
}

function mapVerifyPinCtx(ctx) {
  return {
    ...ctx,
    to: getTo(ctx),
    appName: ctx.appName || APP_DEFAULT,
    verificationCode: ctx.verificationCode || ctx.pin || ctx.pin_code || ctx.codigo || "",
    verificationUrl: ctx.verificationUrl || ctx.url || ctx.link || "",
    expiresIn: ctx.expiresIn || ctx.expiresAt || ctx.expires_at || "",
    nombre: ctx.nombre || ctx.name || "",
  };
}

    function mapPasswordRecoveryCtx(ctx) {
      return {
        ...ctx,
        to: getTo(ctx),
        appName: ctx.appName || APP_DEFAULT,
        nombre: ctx.nombre || ctx.name || "",
        recoveryCode: ctx.recoveryCode || ctx.pin || ctx.pin_code || ctx.codigo || "",
        expiresIn: ctx.expiresIn || ctx.expiresAt || ctx.expires_at || "",
      };
  }
    

function mapCitaCtx(ctx) {
  const inicio = ctx.inicio || ctx.start || ctx.begin || "";
  const citaFecha = ctx.citaFecha || ctx.fecha || isoDate(inicio) || "";
  const citaHora = ctx.citaHora || ctx.hora || isoTime(inicio) || "";

  return {
    ...ctx,
    to: getTo(ctx),
    appName: ctx.appName || APP_DEFAULT,
    nombre: ctx.nombre || ctx.name || "",
    citaFecha,
    citaHora,
    terapeuta: ctx.terapeuta || ctx.therapist || "",
    especialidad: ctx.especialidad || ctx.specialty || "",
    canal: ctx.canal || ctx.modalidad || "",
    meetingUrl: ctx.meetingUrl || ctx.meeting_url || ctx.enlace || "",
    gestionUrl: ctx.gestionUrl || ctx.gestion_url || ctx.manageUrl || "",
    citaId: ctx.citaId || ctx.id_cita || ctx.id || "",
    motivo: ctx.motivo || ctx.reason || "",
    old_citaFecha: ctx.old_citaFecha || ctx.old_fecha || isoDate(ctx.old_inicio || ctx.old_start) || "",
    old_citaHora: ctx.old_citaHora || ctx.old_hora || isoTime(ctx.old_inicio || ctx.old_start) || "",
  };
}

const templates = {
  // ------------------------------------------------------------
  // 1) VERIFICACIÓN DE CUENTA
  // ------------------------------------------------------------
  VERIFICACION_CUENTA: {
    to: (ctx) => [getTo(ctx)].filter(Boolean),
    subject: (ctx) => `Verifica tu cuenta en ${ctx.appName || APP_DEFAULT}`,
    text: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      return (
        `${hi(ctx.nombre)}\n\n` +
        `Para completar tu registro en ${app}, verifica tu cuenta.\n\n` +
        (ctx.verificationCode ? `Código de verificación: ${ctx.verificationCode}\n` : "") +
        (ctx.verificationUrl ? `Enlace: ${ctx.verificationUrl}\n` : "") +
        (ctx.expiresIn ? `\nEste código/enlace vence en: ${ctx.expiresIn}.\n` : "") +
        `\nSi tú no solicitaste esta verificación, puedes ignorar este correo.\n\n` +
        `— Equipo ${app}`
      );
    },
    html: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      const code = ctx.verificationCode
        ? `<p style="margin:10px 0;"><b>Código de verificación:</b> <span style="font-size:18px;letter-spacing:1px;">${ctx.verificationCode}</span></p>`
        : "";
      const link = ctx.verificationUrl
        ? `<p style="margin:10px 0;"><a href="${ctx.verificationUrl}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Verificar cuenta</a></p>`
        : "";
      const exp = ctx.expiresIn
        ? `<p style="margin:10px 0;color:#666;font-size:13px;">Vence en: ${ctx.expiresIn}</p>`
        : "";

      return wrapHtml(`
        <h2 style="margin:0 0 10px 0;">Verificación de cuenta</h2>
        <p style="margin:0 0 10px 0;">${hi(ctx.nombre)}</p>
        <p style="margin:0 0 10px 0;">Para completar tu registro en <b>${app}</b>, verifica tu cuenta:</p>
        ${code}
        ${link}
        ${exp}
        <p style="margin:10px 0;color:#666;font-size:13px;">Si tú no solicitaste esta verificación, ignora este correo.</p>
        <p style="margin:10px 0 0 0;">— Equipo ${app}</p>
      `);
    },
  },

  // ------------------------------------------------------------
  // 2) CITA PENDIENTE
  // ------------------------------------------------------------
  CITA_PENDIENTE: {
    to: (ctx) => [getTo(ctx)].filter(Boolean),
    subject: (ctx) => `Tu cita está pendiente de confirmación — ${ctx.appName || APP_DEFAULT}`,
    text: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      return (
        `${hi(ctx.nombre)}\n\n` +
        `Recibimos tu solicitud de cita y está pendiente de confirmación.\n` +
        `${fmtLine("Fecha", ctx.citaFecha)}` +
        `${fmtLine("Hora", ctx.citaHora)}` +
        `${fmtLine("Terapeuta", ctx.terapeuta)}` +
        `${fmtLine("Especialidad", ctx.especialidad)}` +
        `${fmtLine("Modalidad/Canal", ctx.canal)}` +
        `${fmtLine("ID de cita", ctx.citaId)}\n\n` +
        `Te notificaremos apenas sea confirmada.\n\n` +
        `— Equipo ${app}`
      );
    },
    html: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      return wrapHtml(`
        <h2 style="margin:0 0 10px 0;">Cita pendiente</h2>
        <p style="margin:0 0 10px 0;">${hi(ctx.nombre)}</p>
        <p style="margin:0 0 12px 0;">Recibimos tu solicitud de cita y está <b>pendiente de confirmación</b>.</p>
        <ul style="margin:0 0 12px 18px;">
          ${ctx.citaFecha ? `<li><b>Fecha:</b> ${ctx.citaFecha}</li>` : ""}
          ${ctx.citaHora ? `<li><b>Hora:</b> ${ctx.citaHora}</li>` : ""}
          ${ctx.terapeuta ? `<li><b>Terapeuta:</b> ${ctx.terapeuta}</li>` : ""}
          ${ctx.especialidad ? `<li><b>Especialidad:</b> ${ctx.especialidad}</li>` : ""}
          ${ctx.canal ? `<li><b>Modalidad/Canal:</b> ${ctx.canal}</li>` : ""}
          ${ctx.citaId ? `<li><b>ID de cita:</b> ${ctx.citaId}</li>` : ""}
        </ul>
        <p style="margin:0;">Te notificaremos apenas sea confirmada.</p>
        <p style="margin:10px 0 0 0;">— Equipo ${app}</p>
      `);
    },
  },

  // ------------------------------------------------------------
  // 3) CITA CONFIRMADA
  // ------------------------------------------------------------
  CITA_CONFIRMADA: {
    to: (ctx) => [getTo(ctx)].filter(Boolean),
    subject: (ctx) => `Cita confirmada — ${ctx.appName || APP_DEFAULT}`,
    text: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      return (
        `${hi(ctx.nombre)}\n\n` +
        `Tu cita fue confirmada.\n` +
        `${fmtLine("Fecha", ctx.citaFecha)}` +
        `${fmtLine("Hora", ctx.citaHora)}` +
        `${fmtLine("Terapeuta", ctx.terapeuta)}` +
        `${fmtLine("Modalidad/Canal", ctx.canal)}` +
        `${fmtLine("Enlace de sesión", ctx.meetingUrl)}` +
        `${fmtLine("Gestionar cita", ctx.gestionUrl)}` +
        `${fmtLine("ID de cita", ctx.citaId)}\n\n` +
        `Si necesitas reprogramar o cancelar, usa el enlace “Gestionar cita”.\n\n` +
        `— Equipo ${app}`
      );
    },
    html: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      const meetingBtn = ctx.meetingUrl
        ? `<p style="margin:10px 0;"><a href="${ctx.meetingUrl}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Entrar a la sesión</a></p>`
        : "";
      const manageBtn = ctx.gestionUrl
        ? `<p style="margin:10px 0;"><a href="${ctx.gestionUrl}" style="display:inline-block;padding:10px 14px;background:#f2f2f2;color:#111;text-decoration:none;border-radius:8px;">Gestionar cita</a></p>`
        : "";

      return wrapHtml(`
        <h2 style="margin:0 0 10px 0;">Cita confirmada</h2>
        <p style="margin:0 0 10px 0;">${hi(ctx.nombre)}</p>
        <p style="margin:0 0 12px 0;">Tu cita fue <b>confirmada</b>:</p>
        <ul style="margin:0 0 12px 18px;">
          ${ctx.citaFecha ? `<li><b>Fecha:</b> ${ctx.citaFecha}</li>` : ""}
          ${ctx.citaHora ? `<li><b>Hora:</b> ${ctx.citaHora}</li>` : ""}
          ${ctx.terapeuta ? `<li><b>Terapeuta:</b> ${ctx.terapeuta}</li>` : ""}
          ${ctx.canal ? `<li><b>Modalidad/Canal:</b> ${ctx.canal}</li>` : ""}
          ${ctx.citaId ? `<li><b>ID de cita:</b> ${ctx.citaId}</li>` : ""}
        </ul>
        ${meetingBtn}
        ${manageBtn}
        <p style="margin:0;color:#666;font-size:13px;">Si necesitas reprogramar o cancelar, usa “Gestionar cita”.</p>
        <p style="margin:10px 0 0 0;">— Equipo ${app}</p>
      `);
    },
  },

  // ------------------------------------------------------------
  // 4) CITA RECHAZADA (NUEVA)
  // ------------------------------------------------------------
  CITA_RECHAZADA: {
    to: (ctx) => [getTo(ctx)].filter(Boolean),
    subject: (ctx) => `Cita rechazada — ${ctx.appName || APP_DEFAULT}`,
    text: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      return (
        `${hi(ctx.nombre)}\n\n` +
        `Tu cita fue rechazada.\n` +
        `${fmtLine("Fecha", ctx.citaFecha)}` +
        `${fmtLine("Hora", ctx.citaHora)}` +
        `${fmtLine("Terapeuta", ctx.terapeuta)}` +
        `${fmtLine("Modalidad/Canal", ctx.canal)}` +
        `${fmtLine("Motivo", ctx.motivo)}` +
        `${fmtLine("Gestionar cita", ctx.gestionUrl)}` +
        `${fmtLine("ID de cita", ctx.citaId)}\n\n` +
        `Si deseas, puedes reprogramar desde “Gestionar cita”.\n\n` +
        `— Equipo ${app}`
      );
    },
    html: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      const manageBtn = ctx.gestionUrl
        ? `<p style="margin:10px 0;"><a href="${ctx.gestionUrl}" style="display:inline-block;padding:10px 14px;background:#f2f2f2;color:#111;text-decoration:none;border-radius:8px;">Gestionar cita</a></p>`
        : "";
      const motivoBox = ctx.motivo
        ? `<p style="margin:10px 0;padding:10px 12px;background:#fafafa;border:1px solid #eee;border-radius:10px;"><b>Motivo:</b> ${ctx.motivo}</p>`
        : "";

      return wrapHtml(`
        <h2 style="margin:0 0 10px 0;">Cita rechazada</h2>
        <p style="margin:0 0 10px 0;">${hi(ctx.nombre)}</p>
        <p style="margin:0 0 12px 0;">Tu cita fue <b>rechazada</b>.</p>
        <ul style="margin:0 0 12px 18px;">
          ${ctx.citaFecha ? `<li><b>Fecha:</b> ${ctx.citaFecha}</li>` : ""}
          ${ctx.citaHora ? `<li><b>Hora:</b> ${ctx.citaHora}</li>` : ""}
          ${ctx.terapeuta ? `<li><b>Terapeuta:</b> ${ctx.terapeuta}</li>` : ""}
          ${ctx.canal ? `<li><b>Modalidad/Canal:</b> ${ctx.canal}</li>` : ""}
          ${ctx.citaId ? `<li><b>ID de cita:</b> ${ctx.citaId}</li>` : ""}
        </ul>
        ${motivoBox}
        ${manageBtn}
        <p style="margin:0;color:#666;font-size:13px;">Si deseas, puedes reprogramar desde “Gestionar cita”.</p>
        <p style="margin:10px 0 0 0;">— Equipo ${app}</p>
      `);
    },
  },

  // ------------------------------------------------------------
  // 5) CITA MODIFICADA (NUEVA)
  // ------------------------------------------------------------
  CITA_MODIFICADA: {
    to: (ctx) => [getTo(ctx)].filter(Boolean),
    subject: (ctx) => `Cita modificada — ${ctx.appName || APP_DEFAULT}`,
    text: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      const before = (ctx.old_citaFecha || ctx.old_citaHora)
        ? `\nAntes: ${[ctx.old_citaFecha, ctx.old_citaHora].filter(Boolean).join(" ")}`
        : "";
      const after = (ctx.citaFecha || ctx.citaHora)
        ? `\nAhora: ${[ctx.citaFecha, ctx.citaHora].filter(Boolean).join(" ")}`
        : "";

      return (
        `${hi(ctx.nombre)}\n\n` +
        `Tu cita fue modificada.` +
        `${before}${after}\n` +
        `${fmtLine("Terapeuta", ctx.terapeuta)}` +
        `${fmtLine("Modalidad/Canal", ctx.canal)}` +
        `${fmtLine("Enlace de sesión", ctx.meetingUrl)}` +
        `${fmtLine("Gestionar cita", ctx.gestionUrl)}` +
        `${fmtLine("Motivo", ctx.motivo)}` +
        `${fmtLine("ID de cita", ctx.citaId)}\n\n` +
        `— Equipo ${app}`
      );
    },
    html: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      const before = (ctx.old_citaFecha || ctx.old_citaHora)
        ? `<p style="margin:6px 0;"><b>Antes:</b> ${[ctx.old_citaFecha, ctx.old_citaHora].filter(Boolean).join(" ")}</p>`
        : "";
      const after = (ctx.citaFecha || ctx.citaHora)
        ? `<p style="margin:6px 0;"><b>Ahora:</b> ${[ctx.citaFecha, ctx.citaHora].filter(Boolean).join(" ")}</p>`
        : "";

      const meetingBtn = ctx.meetingUrl
        ? `<p style="margin:10px 0;"><a href="${ctx.meetingUrl}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Entrar a la sesión</a></p>`
        : "";
      const manageBtn = ctx.gestionUrl
        ? `<p style="margin:10px 0;"><a href="${ctx.gestionUrl}" style="display:inline-block;padding:10px 14px;background:#f2f2f2;color:#111;text-decoration:none;border-radius:8px;">Gestionar cita</a></p>`
        : "";
      const motivoBox = ctx.motivo
        ? `<p style="margin:10px 0;padding:10px 12px;background:#fafafa;border:1px solid #eee;border-radius:10px;"><b>Motivo:</b> ${ctx.motivo}</p>`
        : "";

      return wrapHtml(`
        <h2 style="margin:0 0 10px 0;">Cita modificada</h2>
        <p style="margin:0 0 10px 0;">${hi(ctx.nombre)}</p>
        <p style="margin:0 0 12px 0;">Tu cita fue <b>modificada</b>.</p>
        ${before}
        ${after}
        <ul style="margin:0 0 12px 18px;">
          ${ctx.terapeuta ? `<li><b>Terapeuta:</b> ${ctx.terapeuta}</li>` : ""}
          ${ctx.canal ? `<li><b>Modalidad/Canal:</b> ${ctx.canal}</li>` : ""}
          ${ctx.citaId ? `<li><b>ID de cita:</b> ${ctx.citaId}</li>` : ""}
        </ul>
        ${motivoBox}
        ${meetingBtn}
        ${manageBtn}
        <p style="margin:10px 0 0 0;">— Equipo ${app}</p>
      `);
    },
  },

  // ------------------------------------------------------------
  // 6) WELCOME_* (NUEVAS)
  // ------------------------------------------------------------
  welcome_admin: {
    to: (ctx) => [getTo(ctx)].filter(Boolean),
    subject: (ctx) => `Bienvenido/a al panel de administración — ${ctx.appName || APP_DEFAULT}`,
    text: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      return (
        `${hi(ctx.nombre)}\n\n` +
        `Tu cuenta de administrador/a en ${app} fue creada correctamente.\n` +
        `${fmtLine("Acceso", ctx.loginUrl || ctx.appUrl || ctx.frontendUrl)}\n\n` +
        `— Equipo ${app}`
      );
    },
    html: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      const url = ctx.loginUrl || ctx.appUrl || ctx.frontendUrl || "";
      const btn = url
        ? `<p style="margin:10px 0;"><a href="${url}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Ir al panel</a></p>`
        : "";
      return wrapHtml(`
        <h2 style="margin:0 0 10px 0;">Bienvenido/a (Admin)</h2>
        <p style="margin:0 0 10px 0;">${hi(ctx.nombre)}</p>
        <p style="margin:0 0 10px 0;">Tu cuenta de administrador/a en <b>${app}</b> fue creada correctamente.</p>
        ${btn}
        <p style="margin:10px 0 0 0;">— Equipo ${app}</p>
      `);
    },
  },

  welcome_paciente: {
    to: (ctx) => [getTo(ctx)].filter(Boolean),
    subject: (ctx) => `¡Bienvenido/a a ${ctx.appName || APP_DEFAULT}!`,
    text: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      return (
        `${hi(ctx.nombre)}\n\n` +
        `Tu cuenta en ${app} fue creada correctamente.\n` +
        `${fmtLine("Ingresar", ctx.appUrl || ctx.frontendUrl)}\n\n` +
        `— Equipo ${app}`
      );
    },
    html: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      const url = ctx.appUrl || ctx.frontendUrl || "";
      const btn = url
        ? `<p style="margin:10px 0;"><a href="${url}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Ingresar</a></p>`
        : "";
      return wrapHtml(`
        <h2 style="margin:0 0 10px 0;">¡Bienvenido/a!</h2>
        <p style="margin:0 0 10px 0;">${hi(ctx.nombre)}</p>
        <p style="margin:0 0 10px 0;">Tu cuenta en <b>${app}</b> fue creada correctamente.</p>
        ${btn}
        <p style="margin:10px 0 0 0;">— Equipo ${app}</p>
      `);
    },
  },

  welcome_terapeuta: {
    to: (ctx) => [getTo(ctx)].filter(Boolean),
    subject: (ctx) => `Bienvenido/a como terapeuta — ${ctx.appName || APP_DEFAULT}`,
    text: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      return (
        `${hi(ctx.nombre)}\n\n` +
        `Tu cuenta de terapeuta en ${app} fue creada correctamente.\n` +
        `${fmtLine("Ingresar", ctx.appUrl || ctx.frontendUrl)}\n\n` +
        `— Equipo ${app}`
      );
    },
    html: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      const url = ctx.appUrl || ctx.frontendUrl || "";
      const btn = url
        ? `<p style="margin:10px 0;"><a href="${url}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Ingresar</a></p>`
        : "";
      return wrapHtml(`
        <h2 style="margin:0 0 10px 0;">Bienvenido/a (Terapeuta)</h2>
        <p style="margin:0 0 10px 0;">${hi(ctx.nombre)}</p>
        <p style="margin:0 0 10px 0;">Tu cuenta de terapeuta en <b>${app}</b> fue creada correctamente.</p>
        ${btn}
        <p style="margin:10px 0 0 0;">— Equipo ${app}</p>
      `);
    },
  },

  welcome_generic: {
    to: (ctx) => [getTo(ctx)].filter(Boolean),
    subject: (ctx) => `Bienvenido/a — ${ctx.appName || APP_DEFAULT}`,
    text: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      return (
        `${hi(ctx.nombre)}\n\n` +
        `Tu cuenta en ${app} fue creada correctamente.\n` +
        `${fmtLine("Ingresar", ctx.appUrl || ctx.frontendUrl)}\n\n` +
        `— Equipo ${app}`
      );
    },
    html: (ctx) => {
      const app = ctx.appName || APP_DEFAULT;
      const url = ctx.appUrl || ctx.frontendUrl || "";
      const btn = url
        ? `<p style="margin:10px 0;"><a href="${url}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Ingresar</a></p>`
        : "";
      return wrapHtml(`
        <h2 style="margin:0 0 10px 0;">Bienvenido/a</h2>
        <p style="margin:0 0 10px 0;">${hi(ctx.nombre)}</p>
        <p style="margin:0 0 10px 0;">Tu cuenta en <b>${app}</b> fue creada correctamente.</p>
        ${btn}
        <p style="margin:10px 0 0 0;">— Equipo ${app}</p>
      `);
    },
  },
};

// ------------------------------------------------------------
// WRAPPERS SIN DUPLICAR (keys “de sistema” que estás encolando)
// ------------------------------------------------------------

// verify_pin => reutiliza VERIFICACION_CUENTA
templates.verify_pin = {
  to: (ctx) => templates.VERIFICACION_CUENTA.to(mapVerifyPinCtx(ctx)),
  subject: (ctx) => templates.VERIFICACION_CUENTA.subject(mapVerifyPinCtx(ctx)),
  text: (ctx) => templates.VERIFICACION_CUENTA.text(mapVerifyPinCtx(ctx)),
  html: (ctx) => templates.VERIFICACION_CUENTA.html(mapVerifyPinCtx(ctx)),
};

// cita_confirmada => reutiliza CITA_CONFIRMADA
templates.cita_confirmada = {
  to: (ctx) => templates.CITA_CONFIRMADA.to(mapCitaCtx(ctx)),
  subject: (ctx) => templates.CITA_CONFIRMADA.subject(mapCitaCtx(ctx)),
  text: (ctx) => templates.CITA_CONFIRMADA.text(mapCitaCtx(ctx)),
  html: (ctx) => templates.CITA_CONFIRMADA.html(mapCitaCtx(ctx)),
};

// cita_pendiente_programacion => reutiliza CITA_PENDIENTE
templates.cita_pendiente_programacion = {
  to: (ctx) => templates.CITA_PENDIENTE.to(mapCitaCtx(ctx)),
  subject: (ctx) => templates.CITA_PENDIENTE.subject(mapCitaCtx(ctx)),
  text: (ctx) => templates.CITA_PENDIENTE.text(mapCitaCtx(ctx)),
  html: (ctx) => templates.CITA_PENDIENTE.html(mapCitaCtx(ctx)),
};

// cita_rechazada => reutiliza CITA_RECHAZADA (ya nueva)
templates.cita_rechazada = {
  to: (ctx) => templates.CITA_RECHAZADA.to(mapCitaCtx(ctx)),
  subject: (ctx) => templates.CITA_RECHAZADA.subject(mapCitaCtx(ctx)),
  text: (ctx) => templates.CITA_RECHAZADA.text(mapCitaCtx(ctx)),
  html: (ctx) => templates.CITA_RECHAZADA.html(mapCitaCtx(ctx)),
};

// cita_modificada => reutiliza CITA_MODIFICADA (ya nueva)
templates.cita_modificada = {
  to: (ctx) => templates.CITA_MODIFICADA.to(mapCitaCtx(ctx)),
  subject: (ctx) => templates.CITA_MODIFICADA.subject(mapCitaCtx(ctx)),
  text: (ctx) => templates.CITA_MODIFICADA.text(mapCitaCtx(ctx)),
  html: (ctx) => templates.CITA_MODIFICADA.html(mapCitaCtx(ctx)),
};

templates.password_recovery_pin = {
  to: (ctx) => [getTo(ctx)].filter(Boolean),
  subject: (ctx) => `Recuperación de contraseña — ${ctx.appName || APP_DEFAULT}`,
  text: (ctx) => {
    const c = mapPasswordRecoveryCtx(ctx);
    const app = c.appName || APP_DEFAULT;
    return (
      `${hi(c.nombre)}
    ` +
          `Recibimos una solicitud para recuperar tu contraseña en ${app}.

    ` +
          (c.recoveryCode ? `Código de recuperación: ${c.recoveryCode}
    ` : "") +
          (c.expiresIn ? `
    Este código vence en: ${c.expiresIn}.
    ` : "") +
          `
    Si tú no solicitaste este cambio, ignora este correo.

    ` +
          `— Equipo ${app}`
    );
  },
  
  html: (ctx) => {
    const c = mapPasswordRecoveryCtx(ctx);
    const app = c.appName || APP_DEFAULT;
    const code = c.recoveryCode
      ? `<p style="margin:10px 0;"><b>Código de recuperación:</b> <span style="font-size:18px;letter-spacing:1px;">${c.recoveryCode}</span></p>`
      : "";
    const exp = c.expiresIn
      ? `<p style="margin:10px 0;color:#666;font-size:13px;">Vence en: ${c.expiresIn}</p>`
      : "";

    return wrapHtml(`
      <h2 style="margin:0 0 10px 0;">Recuperación de contraseña</h2>
      <p style="margin:0 0 10px 0;">${hi(c.nombre)}</p>
      <p style="margin:0 0 10px 0;">Recibimos una solicitud para recuperar tu contraseña en <b>${app}</b>.</p>
      ${code}
      ${exp}
      <p style="margin:10px 0;color:#666;font-size:13px;">Si tú no solicitaste este cambio, ignora este correo.</p>
      <p style="margin:10px 0 0 0;">— Equipo ${app}</p>
    `);
  },
};

module.exports = templates;
