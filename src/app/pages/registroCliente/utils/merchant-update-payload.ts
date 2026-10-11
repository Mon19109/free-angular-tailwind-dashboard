import { MerchantUpdateDataPayload } from '../../../services/merchant-update-data.service';

type Registro = Record<string, unknown>;
const camposCuenta = [
  'typeAffiliation', 'idStatus', 'name', 'paternalSurname', 'maternalSurname', 'nameCommerce',
  'businessName', 'idBussinesLine', 'businessActivityCode', 'idActivity', 'commerceGuid',
  'commerceAddress', 'rfc', 'curp', 'fiscalRegime', 'capitalRegime', 'contacts',
  'dispersionAccount', 'idbusinessModel', 'typePerson', 'activityDescription',
  'bussinesLineDescription', 'typeOfBusiness',
];

// Parte del GET original y modifica solamente los valores editados en el formulario.
export function crearMerchantUpdatePayload(cuenta: Registro, anteriores: Registro, actuales: Registro): MerchantUpdateDataPayload {
  const guid = String(cuenta['commerceGuid'] || cuenta['guid'] || cuenta['commerceID'] || '');
  const payload: MerchantUpdateDataPayload = { commerceGuid: guid };
  for (const campo of camposCuenta) {
    if (cuenta[campo] !== undefined) payload[campo] = structuredClone(cuenta[campo]);
  }
  payload.commerceGuid = guid;
  const cambio = (campo: string) => actuales[campo] !== anteriores[campo];
  const aplicar = (destino: Registro, mapa: Record<string, string>) => {
    for (const [formulario, api] of Object.entries(mapa)) {
      if (cambio(formulario)) destino[api] = actuales[formulario];
    }
  };
  aplicar(payload, {
    nombre: 'name', apellidoPaterno: 'paternalSurname', apellidoMaterno: 'maternalSurname',
    nombreComercial: 'nameCommerce', razonSocial: 'businessName', rfc: 'rfc', curp: 'curp',
    tipoPersona: 'typePerson', actividad: 'activityDescription', descripcionGiro: 'bussinesLineDescription',
    mcc: 'businessActivityCode', correo: 'email', telefono: 'phoneNumber',
  });
  if (cambio('regimenFiscal')) payload['fiscalRegime'] = String(actuales['regimenFiscal'] ?? '').match(/^\d{3}/)?.[0] || actuales['regimenFiscal'];
  for (const [campo, api] of [['actividadId', 'idActivity'], ['giroId', 'idBussinesLine']]) {
    if (cambio(campo)) {
      const id = Number(actuales[campo]);
      if (!String(actuales[campo] ?? '').trim() || !Number.isInteger(id) || id < 0) throw new Error('Selecciona una actividad o giro válido del catálogo.');
      payload[api] = id;
    }
  }

  const direccion: Record<string, string> = {
    codigoPostal: 'postalCode', tipoVialidad: 'roadType', nombreVialidad: 'roadName',
    numeroExterior: 'extNum', numeroInterior: 'intNum', colonia: 'district', localidad: 'location',
    municipio: 'municipality', entidadFederativa: 'federativeEntity', locationID: 'locationID',
    entreCalle: 'betweenStreet', yCalle: 'andStreet',
  };
  const direcciones = structuredClone((cuenta['commerceAddress'] as Registro[] | undefined) ?? []);
  for (const [tipo, sufijo] of [['DF', ''], ['DC', 'Comercial']]) {
    const mapa = Object.fromEntries(Object.entries(direccion).map(([campo, api]) => [campo + sufijo, api]));
    if (!Object.keys(mapa).some(cambio)) continue;
    let actual = direcciones.find(item => item['addressType'] === tipo);
    if (!actual) {
      actual = { commerceID: guid, addressType: tipo };
      direcciones.push(actual);
    }
    aplicar(actual, mapa);
  }
  if (cuenta['commerceAddress'] !== undefined || direcciones.length) payload['commerceAddress'] = direcciones;

  const contactos = structuredClone((cuenta['contacts'] as Registro[] | undefined) ?? []);
  for (const [tipo, sufijo] of [[1, 'Representante'], [2, 'Comercial']] as const) {
    const mapa: Record<string, string> = {
      ['correo' + sufijo]: 'email', ['telefono' + sufijo]: 'phoneNumber',
      ['telefonoAdicional' + sufijo]: 'additionaPhoneNumber',
    };
    if (tipo === 1) Object.assign(mapa, {
      nombreRepresentante: 'name', apellidoPaternoRepresentante: 'paternalSurname', apellidoMaternoRepresentante: 'maternalSurname',
    });
    const mapaDireccion: Record<string, string> = tipo === 1 ? {
      calleRepresentante: 'street', numeroExteriorRepresentante: 'exteriorNumber',
      numeroInteriorRepresentante: 'interiorNumber', codigoPostalRepresentante: 'postalCode',
      coloniaRepresentante: 'district', municipioRepresentante: 'municipality', estadoRepresentante: 'state',
      locationIDRepresentante: 'idLocation',
    } : {};
    if (![...Object.keys(mapa), ...Object.keys(mapaDireccion)].some(cambio)) continue;
    let contacto = contactos.find(item => Number(item['type']) === tipo);
    if (!contacto) { contacto = { type: tipo }; contactos.push(contacto); }
    aplicar(contacto, mapa);
    if (Object.keys(mapaDireccion).some(cambio)) {
      const direccionContacto = { ...(contacto['address'] as Registro ?? {}) };
      aplicar(direccionContacto, mapaDireccion);
      contacto['address'] = direccionContacto;
    }
  }
  if (cuenta['contacts'] !== undefined || contactos.length) payload['contacts'] = contactos;
  return payload;
}
