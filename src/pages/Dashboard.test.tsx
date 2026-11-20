import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorDatos } from '@/lib/errores';
import { renderizar, repoPrueba, USUARIOS_DEMO } from '@/test/renderizar';
import Dashboard from './Dashboard';

const filas = () => screen.getAllByRole('row').slice(1); // sin la cabecera

describe('Dashboard (UI-01, UI-02, UI-03, UI-05, UI-07)', () => {
  it('muestra carga y luego los proyectos con su estado', async () => {
    renderizar(<Dashboard />);
    expect(await screen.findByText('Techo residencial Ruiz')).toBeTruthy();
    expect(filas()).toHaveLength(7);
    expect(screen.getAllByRole('link', { name: /nuevo proyecto/i })).toHaveLength(1);
  });

  it('un instalador solo ve sus proyectos, sin botón de crear', async () => {
    renderizar(<Dashboard />, { repo: repoPrueba(USUARIOS_DEMO.CAMILA) });
    await screen.findByText('Bodega Solar Norte');
    expect(filas()).toHaveLength(2);
    expect(screen.queryByText('Techo residencial Ruiz')).toBeNull();
    expect(screen.queryByRole('link', { name: /nuevo proyecto/i })).toBeNull();
    expect(screen.getByText(/asignados a Camila/)).toBeTruthy();
  });

  it('las tarjetas resumen filtran la tabla por estado', async () => {
    renderizar(<Dashboard />);
    await screen.findByText('Techo residencial Ruiz');
    const completados = screen.getByRole('button', { name: 'Filtrar por Completado' });
    await waitFor(() => expect(within(completados).getByText('2')).toBeTruthy());
    fireEvent.click(completados);
    expect(completados.getAttribute('aria-pressed')).toBe('true');
    expect(filas()).toHaveLength(2);
    expect(screen.getByRole('heading', { name: /Proyectos: Completado/ })).toBeTruthy();
  });

  it('la búsqueda ignora mayúsculas y tildes', async () => {
    renderizar(<Dashboard />);
    await screen.findByText('Techo residencial Ruiz');
    fireEvent.change(screen.getByLabelText('Buscar proyectos'), { target: { value: 'itagui' } });
    expect(filas()).toHaveLength(1);
    expect(screen.getByText('Panadería Doña Rosa')).toBeTruthy();
  });

  it('avanza el estado de forma optimista', async () => {
    renderizar(<Dashboard />, { repo: repoPrueba(USUARIOS_DEMO.ANDRES) });
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar Techo residencial Ruiz' }));
    const fila = screen.getByText('Techo residencial Ruiz').closest('tr')!;
    expect(within(fila).getByText('En progreso')).toBeTruthy(); // inmediato, antes de que responda
    await waitFor(() => expect(within(fila).getByRole('button', { name: /Completar/ })).toBeTruthy());
  });

  it('si la base de datos rechaza el cambio, revierte y explica el motivo', async () => {
    const cambiarEstado = vi.fn().mockRejectedValue(new ErrorDatos('No tienes permiso para modificar este proyecto.', '42501'));
    renderizar(<Dashboard />, { repo: repoPrueba(USUARIOS_DEMO.ANDRES, { cambiarEstado }) });
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar Techo residencial Ruiz' }));
    expect(await screen.findByText('No tienes permiso para modificar este proyecto.')).toBeTruthy();
    const fila = screen.getByText('Techo residencial Ruiz').closest('tr')!;
    expect(within(fila).getByText('Pendiente')).toBeTruthy();
    expect(cambiarEstado).toHaveBeenCalledWith(expect.any(String), 'en_progreso');
  });

  it('muestra un error de carga con opción de reintentar', async () => {
    let fallar = true;
    const base = repoPrueba();
    const listarProyectos = vi.fn(() => (fallar ? Promise.reject(new ErrorDatos('Sin conexión.')) : base.listarProyectos()));
    renderizar(<Dashboard />, { repo: { ...base, listarProyectos } });
    expect(await screen.findByText('Sin conexión.')).toBeTruthy();
    fallar = false;
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByText('Techo residencial Ruiz')).toBeTruthy();
  });

  it('al cambiar de usuario recarga y descarta respuestas obsoletas', async () => {
    const repo = repoPrueba(USUARIOS_DEMO.LAURA);
    renderizar(<Dashboard />, { repo });
    await screen.findByText('Techo residencial Ruiz');
    repo.demo!.cambiarUsuario(USUARIOS_DEMO.CAMILA);
    await waitFor(() => expect(filas()).toHaveLength(2));
    expect(screen.queryByText('Techo residencial Ruiz')).toBeNull();
  });

  it('UI-07: refleja sin recargar un cambio hecho por otro usuario', async () => {
    const repo = repoPrueba(USUARIOS_DEMO.LAURA);
    renderizar(<Dashboard />, { repo });
    await screen.findByText('Techo residencial Ruiz');
    const fila = () => screen.getByText('Bodega Solar Norte').closest('tr')!;
    expect(within(fila()).getByText('En progreso')).toBeTruthy();
    // "Otro usuario" completa el proyecto: el aviso de cambios dispara una recarga silenciosa.
    const bodega = (await repo.listarProyectos()).find((p) => p.nombre === 'Bodega Solar Norte')!;
    await repo.cambiarEstado(bodega.id, 'completado');
    await waitFor(() => expect(within(fila()).getByText('Completado')).toBeTruthy());
    const completados = screen.getByRole('button', { name: 'Filtrar por Completado' });
    await waitFor(() => expect(within(completados).getByText('3')).toBeTruthy());
  });
});
