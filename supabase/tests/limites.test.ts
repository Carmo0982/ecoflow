// @vitest-environment node
/**
 * ARQ-06 · Los límites que valida el formulario (zod) deben ser los MISMOS
 * que los CHECK de la migración. Si alguien cambia uno y olvida el otro, el
 * usuario vería errores del servidor que el formulario no anticipó.
 */
import { describe, expect, it } from 'vitest';
import { LIMITES } from '../../src/lib/validacion';
import { MIGRACIONES } from './entorno';

const sql = MIGRACIONES.join('\n');

describe('límites del cliente = CHECK de la base de datos', () => {
  it.each(['nombre', 'cliente', 'direccion', 'ciudad'] as const)('%s', (campo) => {
    const { min, max } = LIMITES[campo];
    expect(sql).toContain(`char_length(trim(${campo})) between ${min} and ${max}`);
  });

  it('capacidad (rango y dos decimales) y cantidad', () => {
    expect(sql).toContain(`capacidad_kw > 0 and capacidad_kw <= ${LIMITES.capacidadMaxKw}`);
    expect(sql).toMatch(/capacidad_kw\s+numeric\(8, 2\)/);
    expect(sql).toContain(`cantidad between 1 and ${LIMITES.cantidadMax}`);
  });
});
