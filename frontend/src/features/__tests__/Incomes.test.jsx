import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IncomesDashboard from '../Incomes.jsx';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../api/axios.config.js', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

describe('IncomesDashboard', () => {
  beforeEach(() => localStorage.clear());

  it('renderiza sin errores de inicialización antes de iniciar sesión', () => {
    render(<IncomesDashboard />);
    expect(screen.getByRole('heading', { name: 'Detalle de Ingresos' })).toBeInTheDocument();
  });
});
