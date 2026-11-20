import { describe, expect, it } from 'vitest';
import { validarProyecto, type ValoresFormulario } from './validacion';

const PANEL = { id: '5a1d0c3e-8b2f-4e6a-9c00-000000000001', nombre: 'Panel', stock: 50 };
const INVERSOR = { id: '5a1d0c3e-8b2f-4e6a-9c00-000000000003', nombre: 'Inversor', stock: 2 };
const INVENTARIO = [PANEL, INVERSOR];

const validos = (cambios: Partial<ValoresFormulario> = {}): ValoresFormulario => ({
  nombre: '  Techo Ruiz  ',
  cliente: 'Familia Ruiz',
  direccion: 'Calle 10 # 43-21',
  ciudad: 'Medellín',
  capacidad_kw: '5.5',
  fecha_inicio: '2026-12-01',
  fecha_fin_estimada: '2026-12-04',
  instalador_id: '',
  materiales: [{ material_id: PANEL.id, cantidad: '10' }],
  ...cambios,
});

const errores = (v: ValoresFormulario) => {
  const r = validarProyecto(v, INVENTARIO);
  if (r.ok) throw new Error('se esperaba un error de validación');
  return r.errores;
};

describe('validarProyecto (UI-04, RN-05, RN-06, RN-08)', () => {
  it('acepta datos válidos y los convierte a los tipos del RPC', () => {
    const r = validarProyecto(validos(), INVENTARIO);
    expect(r).toEqual({
      ok: true,
      datos: {
        nombre: 'Techo Ruiz', // recortado
        cliente: 'Familia Ruiz',
        direccion: 'Calle 10 # 43-21',
        ciudad: 'Medellín',
        capacidad_kw: 5.5, // número, no texto
        fecha_inicio: '2026-12-01',
        fecha_fin_estimada: '2026-12-04',
        instalador_id: null, // '' → null
        materiales: [{ material_id: PANEL.id, cantidad: 10 }],
      },
    });
  });

  it('acepta la misma fecha de inicio y fin', () => {
    expect(validarProyecto(validos({ fecha_fin_estimada: '2026-12-01' }), INVENTARIO).ok).toBe(true);
  });

  it('RN-05: rechaza fin anterior al inicio', () => {
    expect(errores(validos({ fecha_fin_estimada: '2026-11-30' }))).toEqual({
      fecha_fin_estimada: 'La fecha de fin no puede ser anterior a la de inicio.',
    });
  });

  it.each([
    ['', 'Escribe la capacidad en kWp.'],
    ['abc', 'Escribe un número válido.'],
    ['0', 'La capacidad debe ser mayor que 0 kWp.'],
    ['-3', 'La capacidad debe ser mayor que 0 kWp.'],
    ['10000.01', 'Máximo 10000 kWp.'],
    ['5.555', 'Usa como máximo dos decimales.'],
  ])('RN-06: capacidad %j → %s', (capacidad_kw, mensaje) => {
    expect(errores(validos({ capacidad_kw })).capacidad_kw).toBe(mensaje);
  });

  it('acepta capacidades límite con dos decimales', () => {
    for (const capacidad_kw of ['0.01', '12.35', '10000']) {
      expect(validarProyecto(validos({ capacidad_kw }), INVENTARIO).ok, capacidad_kw).toBe(true);
    }
  });

  it('rechaza textos que son solo espacios y fechas inválidas', () => {
    const e = errores(validos({ nombre: '   ', fecha_inicio: '2026-02-30' }));
    expect(e.nombre).toBe('Nombre: mínimo 3 caracteres.');
    expect(e.fecha_inicio).toBe('Elige una fecha de inicio válida.');
  });

  it('rechaza un instalador que no es un UUID', () => {
    expect(errores(validos({ instalador_id: 'admin' })).instalador_id).toBe('Instalador inválido.');
  });

  it('RN-08: cantidad mayor que el stock, decimales y materiales repetidos', () => {
    const e = errores(
      validos({
        materiales: [
          { material_id: INVERSOR.id, cantidad: '3' },
          { material_id: PANEL.id, cantidad: '1.5' },
          { material_id: INVERSOR.id, cantidad: '1' },
          { material_id: '', cantidad: '' },
        ],
      }),
    );
    expect(e).toEqual({
      'materiales.0.cantidad': 'Solo hay 2 en stock.',
      'materiales.1.cantidad': 'La cantidad debe ser un número entero.',
      'materiales.2.material_id': 'Material repetido.',
      'materiales.3.material_id': 'Elige un material.',
      'materiales.3.cantidad': 'Indica la cantidad.',
    });
  });
});
