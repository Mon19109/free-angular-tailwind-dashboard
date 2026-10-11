import { crearMerchantUpdatePayload } from './merchant-update-payload';

describe('Payload de edición de comercio', () => {
  const cuenta = {
    commerceGuid: 'comercio-del-nodo', name: null, typeOfBusiness: 0, idStatus: 0,
    idActivity: 55, fiscalRegime: '601', password: 'no-enviar',
    commerceAddress: [{ commerceAddressID: 111, commerceID: 'comercio-del-nodo', addressType: 'DF', roadName: 'Antes', createdAt: 'fecha-original' }],
    contacts: [{ id: 4, type: 1, name: 'Representante', email: 'antes@example.com', address: { id: 9, street: 'Original' } }],
  };
  it('conserva IDs, ceros, nulls, fechas y contactos al modificar un solo campo', () => {
    const resultado = crearMerchantUpdatePayload(cuenta, { nombreComercial: 'Antes' }, { nombreComercial: 'Después' });
    expect(resultado.commerceGuid).toBe('comercio-del-nodo');
    expect(resultado['nameCommerce']).toBe('Después');
    expect(resultado['name']).toBeNull();
    expect(resultado['typeOfBusiness']).toBe(0);
    expect(resultado['commerceAddress']).toEqual(cuenta.commerceAddress);
    expect(resultado['contacts']).toEqual(cuenta.contacts);
    expect(resultado['password']).toBeUndefined();
  });
  it('actualiza el domicilio por tipo y conserva su identidad', () => {
    const resultado = crearMerchantUpdatePayload(cuenta, { nombreVialidad: 'Antes' }, { nombreVialidad: 'Después' });
    expect(resultado['commerceAddress']).toEqual([{ ...cuenta.commerceAddress[0], roadName: 'Después' }]);
    expect(cuenta.commerceAddress[0].roadName).toBe('Antes');
  });
  it('actualiza el contacto conservando sus otros campos y el domicilio', () => {
    const resultado = crearMerchantUpdatePayload(cuenta, { correoRepresentante: 'antes@example.com' }, { correoRepresentante: 'nuevo@example.com' });
    expect(resultado['contacts']).toEqual([{ ...cuenta.contacts[0], email: 'nuevo@example.com' }]);
  });
  it('envía códigos numéricos de catálogo y el código de régimen fiscal', () => {
    const resultado = crearMerchantUpdatePayload(cuenta,
      { regimenFiscal: '601', actividadId: '55' }, { regimenFiscal: '606 - Arrendamiento', actividadId: '27' });
    expect(resultado['fiscalRegime']).toBe('606');
    expect(resultado['idActivity']).toBe(27);
  });
});
