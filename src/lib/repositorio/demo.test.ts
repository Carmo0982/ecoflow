import { describe, expect, it } from 'vitest';
import { crearRepositorioDemo, MATERIALES_DEMO, USUARIOS_DEMO } from './demo';

const { LAURA, ANDRES, CAMILA } = USUARIOS_DEMO;
const repo = (u = LAURA) => crearRepositorioDemo({ latenciaMs: 0, usuarioInicial: u });

const nuevo = {
  nombre: 'Prueba', cliente: 'Cliente', direccion: 'Calle 1 # 2-3', ciudad: 'Medellín',
  capacidad_kw: 10, fecha_inicio: '2026-12-01', fecha_fin_estimada: '2026-12-02', instalador_id: ANDRES,
};

/** El modo demo debe comportarse como la BD; si no, la demo mentiría sobre el producto. */
describe('repositorio demo imita las reglas de la base de datos', () => {
  it('SEG-01: el instalador solo ve sus proyectos; la coordinadora ve todos', async () => {
    const r = repo(ANDRES);
    const propios = await r.listarProyectos();
    expect(propios.length).toBeGreaterThan(0);
    expect(propios.every((p) => p.instalador_id === ANDRES)).toBe(true);
    expect((await repo(LAURA).listarProyectos()).length).toBeGreaterThan(propios.length);
  });

  it('SEG-06: el resumen de un instalador solo cuenta sus proyectos', async () => {
    const r = repo(CAMILA);
    const total = (await r.resumen()).reduce((s, f) => s + f.total, 0);
    expect(total).toBe((await r.listarProyectos()).length);
  });

  it('un proyecto ajeno no existe para el instalador (null, no error)', async () => {
    const ajeno = (await repo(LAURA).listarProyectos()).find((p) => p.instalador_id === CAMILA)!;
    expect(await repo(ANDRES).obtenerProyecto(ajeno.id)).toBeNull();
    await expect(repo(ANDRES).cambiarEstado(ajeno.id, 'en_progreso')).rejects.toMatchObject({ codigo: '42501' });
  });

  it('RN-02: no se puede saltar ni retroceder estados', async () => {
    const r = repo(ANDRES);
    const p = (await r.listarProyectos()).find((x) => x.estado === 'pendiente')!;
    await expect(r.cambiarEstado(p.id, 'completado')).rejects.toMatchObject({ codigo: '23514' });
    await r.cambiarEstado(p.id, 'en_progreso');
    await expect(r.cambiarEstado(p.id, 'pendiente')).rejects.toMatchObject({ codigo: '23514' });
    await r.cambiarEstado(p.id, 'completado');
    expect((await r.obtenerProyecto(p.id))?.completado_en).toBeTruthy(); // RN-04
  });

  it('RN-03: no se inicia un proyecto sin instalador', async () => {
    const r = repo(LAURA);
    const libre = (await r.listarProyectos()).find((p) => !p.instalador_id)!;
    await expect(r.cambiarEstado(libre.id, 'en_progreso')).rejects.toMatchObject({ codigo: '23514' });
  });

  it('SEG-02: un instalador no puede crear proyectos', async () => {
    await expect(repo(ANDRES).crearProyecto({ ...nuevo, materiales: [] })).rejects.toMatchObject({ codigo: '42501' });
  });

  it('RN-07/RN-08: crea, descuenta stock y es todo o nada', async () => {
    const r = repo(LAURA);
    const [panel, inversor] = [MATERIALES_DEMO[0]!, MATERIALES_DEMO[3]!];
    const stock = async (id: string) => (await r.listarMateriales()).find((m) => m.id === id)!.stock;
    const antes = { panel: await stock(panel.id), inversor: await stock(inversor.id) };

    // Falla por el inversor → el panel NO se descuenta y no se crea el proyecto.
    const cuantos = (await r.listarProyectos()).length;
    await expect(
      r.crearProyecto({ ...nuevo, materiales: [{ material_id: panel.id, cantidad: 5 }, { material_id: inversor.id, cantidad: 99 }] }),
    ).rejects.toMatchObject({ codigo: 'P0001' });
    expect(await stock(panel.id)).toBe(antes.panel);
    expect((await r.listarProyectos()).length).toBe(cuantos);

    const id = await r.crearProyecto({ ...nuevo, materiales: [{ material_id: panel.id, cantidad: 5 }] });
    expect(await stock(panel.id)).toBe(antes.panel - 5);
    const creado = await r.obtenerProyecto(id);
    expect(creado).toMatchObject({ estado: 'pendiente', creado_por: LAURA, instalador: { id: ANDRES } });
    expect(creado?.materiales).toEqual([expect.objectContaining({ cantidad: 5 })]);
  });

  it('cada repositorio tiene su propio estado (las pruebas no se contaminan)', async () => {
    const a = repo(LAURA);
    await a.crearProyecto({ ...nuevo, materiales: [] });
    expect((await a.listarProyectos()).length).toBe((await repo(LAURA).listarProyectos()).length + 1);
  });

  it('avisa a los suscriptores y permite cambiar de usuario', async () => {
    const r = repo(LAURA);
    let avisos = 0;
    const quitar = r.suscribirCambios(() => avisos++);
    await r.crearProyecto({ ...nuevo, materiales: [] });
    await new Promise((res) => setTimeout(res, 5));
    expect(avisos).toBe(1);
    quitar();

    let sesion = 0;
    r.alCambiarSesion(() => sesion++);
    r.demo!.cambiarUsuario(CAMILA);
    expect(sesion).toBe(1);
    expect((await r.obtenerPerfil())?.rol).toBe('instalador');
  });
});
