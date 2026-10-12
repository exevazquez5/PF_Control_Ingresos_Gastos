import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TransactionModal from '../TransactionModal';
import { MAX_AMOUNT_MESSAGE } from '../../utils/limits';
import { todayInputDate } from '../../utils/date';

const categories = [
  { id: 1, name: 'Salario', type: 'ingreso', isSystem: true },
  { id: 2, name: 'Alimentación', type: 'gasto', isSystem: true },
  { id: 3, name: 'Freelance', type: 'ingreso', isSystem: true }
];

function renderModal({ formData = {}, incomeSources = [], ...props } = {}) {
  const baseFormData = {
    type: 'ingreso',
    category: '',
    amount: '',
    grossAmount: '',
    isRecurring: false,
    sourceId: null,
    sourceName: '',
    mode: 'neto',
    date: '2026-10-12',
    description: '',
    categoryId: '',
    fundingSource: 'Income',
    ...formData
  };
  const setFormData = vi.fn();
  const handleSubmit = vi.fn();

  const view = render(
    <TransactionModal
      showModal
      onClose={() => {}}
      editingTransaction={null}
      formData={baseFormData}
      setFormData={setFormData}
      categories={categories}
      incomeSources={incomeSources}
      enCuotas={false}
      setEnCuotas={() => {}}
      cantidadCuotas={1}
      setCantidadCuotas={() => {}}
      formError=""
      resetForm={() => {}}
      handleSubmit={handleSubmit}
      {...props}
    />
  );

  return { setFormData, handleSubmit, formData: baseFormData, ...view };
}

describe('TransactionModal', () => {
  it('muestra el toggle de recurrencia para ingresos (D10)', () => {
    renderModal();
    expect(screen.getByText('Se repite todos los meses')).toBeInTheDocument();
  });

  it('oculta el toggle de recurrencia para gastos (D10)', () => {
    renderModal({ formData: { type: 'gasto' } });
    expect(screen.queryByText('Se repite todos los meses')).not.toBeInTheDocument();
  });

  it('ofrece el campo Bruto solo con categoría laboral en ingresos (D4)', () => {
    renderModal({ formData: { categoryId: 1 } });
    expect(screen.getByText('+ Bruto del recibo (opcional)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('+ Bruto del recibo (opcional)'));
    expect(screen.getByText('Bruto del recibo')).toBeInTheDocument();
  });

  it('oculta el campo Bruto sin categoría laboral y en gastos (D4)', () => {
    renderModal({ formData: { categoryId: '' } });
    expect(screen.queryByText('+ Bruto del recibo (opcional)')).not.toBeInTheDocument();

    renderModal({ formData: { type: 'gasto', categoryId: 2 } });
    expect(screen.queryByText('+ Bruto del recibo (opcional)')).not.toBeInTheDocument();
  });

  it('muestra el límite de 10M con el literal del backend y deshabilita el botón (D5)', () => {
    renderModal({ formData: { amount: '10000001' } });
    expect(screen.getByText(MAX_AMOUNT_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });

  it('habilita el botón con un monto dentro del límite (D5)', () => {
    renderModal({ formData: { amount: '9999999.99' } });
    expect(screen.queryByText(MAX_AMOUNT_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeEnabled();
  });

  it('el literal del límite es idéntico al del backend', () => {
    expect(MAX_AMOUNT_MESSAGE).toBe('El monto no puede exceder $10,000,000');
  });

  it('la fecha por defecto es hoy (YYYY-MM-DD local)', () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(todayInputDate()).toBe(expected);
  });

  it('muestra la categoría seleccionada en el combobox', () => {
    renderModal({ formData: { categoryId: 1 } });
    expect(screen.getByRole('button', { name: /Salario/ })).toBeInTheDocument();
  });

  it('muestra el error del servidor en formError', () => {
    renderModal({ formError: 'Error del servidor' });
    expect(screen.getByText('Error del servidor')).toBeInTheDocument();
  });

  it('muestra la fuente de ingreso para ingresos y la oculta para gastos (Fase 3)', () => {
    renderModal();
    expect(screen.getByLabelText('Fuente de ingreso')).toBeInTheDocument();
  });

  it('oculta la fuente de ingreso para gastos (Fase 3)', () => {
    renderModal({ formData: { type: 'gasto' } });
    expect(screen.queryByLabelText('Fuente de ingreso')).not.toBeInTheDocument();
  });

  it('al elegir una fuente aplica su modo (D1)', () => {
    const { setFormData } = renderModal({
      formData: { categoryId: 1 },
      incomeSources: [{ id: 7, name: 'Empresa SACME', mode: 'bruto', aliases: ['ACME vieja'] }]
    });

    fireEvent.click(screen.getByLabelText('Fuente de ingreso'));
    fireEvent.click(screen.getByRole('button', { name: /Empresa SACME/ }));

    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: 7,
      sourceName: 'Empresa SACME',
      mode: 'bruto'
    }));
  });

  it('modo bruto muestra el bruto obligatorio y deshabilita el botón (D1)', () => {
    renderModal({ formData: { mode: 'bruto' } });

    expect(screen.getByText(/Bruto del recibo/)).toBeInTheDocument();
    expect(screen.getByText('En modo bruto el bruto del recibo es obligatorio.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });

  it('modo bruto con bruto cargado habilita el botón (D1)', () => {
    renderModal({ formData: { mode: 'bruto', grossAmount: '1500' } });

    expect(screen.queryByText('En modo bruto el bruto del recibo es obligatorio.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeEnabled();
  });

  it('incomeFields envía sourceId/sourceName/mode solo para ingresos', async () => {
    const { incomeFields } = await import('../../utils/transactionService');

    expect(incomeFields({
      type: 'ingreso', amount: '10', grossAmount: '', isRecurring: false,
      sourceId: 3, sourceName: '', mode: 'bruto'
    })).toEqual({
      grossAmount: null, isRecurring: false, sourceId: 3, sourceName: null, mode: 'bruto'
    });

    expect(incomeFields({
      type: 'ingreso', amount: '10', grossAmount: '', isRecurring: false,
      sourceId: null, sourceName: 'Empresa Nueva', mode: 'neto'
    })).toEqual({
      grossAmount: null, isRecurring: false, sourceId: null, sourceName: 'Empresa Nueva', mode: 'neto'
    });

    expect(incomeFields({ type: 'gasto', amount: '10' })).toEqual({});
  });
});
