import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorDatos } from '@/lib/errores';
import { MATERIALES_DEMO } from '@/lib/repositorio/demo';
import { renderizar, repoPrueba, USUARIOS_DEMO } from '@/test/renderizar';
import NuevoProyecto from './NuevoProyecto';

const RUTA = { ruta: '/proyectos/nuevo', patron: '/proyectos/nuevo' };
const escribir = (etiqueta: string | RegExp, valor: string) =>
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

function llenarValido() {
  escribir('Nombre del proyecto', 'Planta Solar Sabaneta');
  escribir('Cliente', 'Industrias Sabaneta');
  escribir('Dirección', 'Carrera 43A # 60 Sur-20');
  escribir('Ciudad', 'Sabaneta');
  escribir('Capacidad (kWp)', '30');
  escribir('Fecha de inicio', '2027-02-01');
  escribir('Fecha fin estimada', '2027-02-15');
}

describe('Formulario de nuevo proyecto (UI-04)', () => {
  it('no llama a Supabase si la validación falla y marca los campos', async () => {
    const crearProyecto = vi.fn();
    renderizar(<NuevoProyecto />, { ...RUTA, repo: repoPrueba(USUARIOS_DEMO.LAURA, { crearProyecto }) });
    await screen.findByText('Nuevo proyecto de instalación');

    escribir('Fecha de inicio', '2027-02-10');
    escribir('Fecha fin estimada', '2027-02-01');
    fireEvent.click(screen.getByRole('button', { name: 'Crear proyecto' }));

    expect(await screen.findByText('La fecha de fin no puede ser anterior a la de inicio.')).toBeTruthy();
    expect(screen.getByText('Nombre: mínimo 3 caracteres.')).toBeTruthy();
    expect(screen.getByLabelText('Nombre del proyecto').getAttribute('aria-invalid')).toBe('true');
    expect(crearProyecto).not.toHaveBeenCalled();
  });

  it('valida el stock de cada material antes de enviar (RN-08)', async () => {
    const crearProyecto = vi.fn();
    renderizar(<NuevoProyecto />, { ...RUTA, repo: repoPrueba(USUARIOS_DEMO.LAURA, { crearProyecto }) });
    await screen.findByText('Nuevo proyecto de instalación');
    llenarValido();
    fireEvent.click(screen.getByRole('button', { name: /Agregar material/ }));
    const inversor = MATERIALES_DEMO[3]!; // stock 3
    escribir('Material 1', inversor.id);
    escribir('Cantidad del material 1', '4');
    fireEvent.click(screen.getByRole('button', { name: 'Crear proyecto' }));
    expect(await screen.findByText('Solo hay 3 en stock.')).toBeTruthy();
    expect(crearProyecto).not.toHaveBeenCalled();
  });

  it('envía datos tipados y navega al detalle', async () => {
    const crearProyecto = vi.fn().mockResolvedValue('nuevo-id');
    renderizar(<NuevoProyecto />, { ...RUTA, repo: repoPrueba(USUARIOS_DEMO.LAURA, { crearProyecto }) });
    await screen.findByText('Nuevo proyecto de instalación');
    llenarValido();
    escribir('Instalador asignado', USUARIOS_DEMO.CAMILA);
    fireEvent.click(screen.getByRole('button', { name: /Agregar material/ }));
    escribir('Material 1', MATERIALES_DEMO[0]!.id);
    escribir('Cantidad del material 1', '12');
    fireEvent.click(screen.getByRole('button', { name: 'Crear proyecto' }));

    expect(await screen.findByText('Detalle abierto')).toBeTruthy();
    expect(crearProyecto).toHaveBeenCalledWith({
      nombre: 'Planta Solar Sabaneta',
      cliente: 'Industrias Sabaneta',
      direccion: 'Carrera 43A # 60 Sur-20',
      ciudad: 'Sabaneta',
      capacidad_kw: 30,
      fecha_inicio: '2027-02-01',
      fecha_fin_estimada: '2027-02-15',
      instalador_id: USUARIOS_DEMO.CAMILA,
      materiales: [{ material_id: MATERIALES_DEMO[0]!.id, cantidad: 12 }],
    });
  });

  it('muestra el error del servidor y permite reintentar', async () => {
    const crearProyecto = vi.fn().mockRejectedValue(new ErrorDatos('Stock insuficiente para uno de los materiales.', 'P0001'));
    renderizar(<NuevoProyecto />, { ...RUTA, repo: repoPrueba(USUARIOS_DEMO.LAURA, { crearProyecto }) });
    await screen.findByText('Nuevo proyecto de instalación');
    llenarValido();
    fireEvent.click(screen.getByRole('button', { name: 'Crear proyecto' }));
    expect(await screen.findByText('Stock insuficiente para uno de los materiales.')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear proyecto' }).hasAttribute('disabled')).toBe(false));
  });

  it('un instalador no ve el formulario', async () => {
    renderizar(<NuevoProyecto />, { ...RUTA, repo: repoPrueba(USUARIOS_DEMO.ANDRES) });
    expect(await screen.findByText('Solo la coordinación puede crear proyectos.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Crear proyecto' })).toBeNull();
  });
});
