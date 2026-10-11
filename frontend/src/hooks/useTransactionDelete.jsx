// hooks/useTransactionDelete.js
import { useCallback } from 'react';

/**
 * Hook para manejar la eliminación de transacciones
 * @param {Function} setConfirmDelete - Función para mostrar confirmación de eliminación
 * @returns {Function} handleDelete - Función para eliminar una transacción
 */
export const useTransactionDelete = (setConfirmDelete) => {
  const handleDelete = useCallback((transaction) => {
    setConfirmDelete({
      show: true,
      target: transaction,
      type: "transaction"
    });
  }, [setConfirmDelete]);

  return handleDelete;
};