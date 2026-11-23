'use strict';
const express = require('express');
const { needAuth } = require('../middlewares/auth.middleware');
const { createNuevoLinkPagoService } = require('../services/nuevo-link-pago.service');

// authorizeOrder(req, action, referenceOrId) debe comprobar la pertenencia real
// de la orden al usuario. Sin implementacion, el acceso se deniega.
function createNuevoLinkPagoRoutes({ baseUrl, authorizeOrder, fetchImpl = fetch }) {
  const router = express.Router();
  const service = createNuevoLinkPagoService({ baseUrl, fetchImpl });
  router.use(needAuth);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  const handle = fn => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (err) {
      const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 502;
      console.error('[nuevo-link-pago]', err.message);
      res.status(status).json({ success: false, message: status === 502 ? 'No fue posible consultar LinkPago' : err.message });
    }
  };
  const token = req => req.session?.auth?.accessToken;
  const allow = async (req, action, id) => {
    if (typeof authorizeOrder !== 'function' || await authorizeOrder(req, action, id) !== true) {
      throw Object.assign(new Error('No autorizado para esta orden'), { status: 403 });
    }
  };

  router.get('/catalogs/notificationTypes', handle(req => service.obtenerTiposNotificacion(token(req))));
  router.get('/catalogs/paymentMethods', handle(req => service.obtenerMetodosPago(token(req))));
  router.get('/order/:referencia', handle(async req => {
    const ref = req.params.referencia;
    if (!ref || ref.length > 200) throw Object.assign(new Error('Referencia invalida'), { status: 400 });
    await allow(req, 'read', ref);
    return service.obtenerLink(token(req), ref);
  }));
  router.put('/order', handle(async req => {
    const payload = req.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.id !== 'string' || !payload.id.trim() || payload.id.length > 200) {
      throw Object.assign(new Error('ID de orden invalido'), { status: 400 });
    }
    await allow(req, 'edit', payload.id);
    // Validar tambien los campos editables segun las reglas de negocio.
    return service.editarLink(token(req), payload);
  }));
  return router;
}
module.exports = { createNuevoLinkPagoRoutes };
