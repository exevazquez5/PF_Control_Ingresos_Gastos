// hooks/useTransactionEdit.js
import { useCallback } from 'react';

export const useTransactionEdit = (setEditingTransaction, setFormData, setShowModal, setEnCuotas, setCantidadCuotas) => {
  const handleEdit = useCallback((transaction) => {
    const normalizedType = transaction.type === 'ingreso' ? 'ingreso' : 'gasto';

    setEditingTransaction(transaction);
    setFormData({
      type: normalizedType,
      category: transaction.category || '',
      amount: transaction.amount,
      date: (transaction.expenseDate || transaction.date).split('T')[0],
      description: transaction.description || '',
      categoryId: transaction.categoryId || '',
      fundingSource: transaction.fundingSource || 'Income'
    });

    if (transaction.type === 'cuota') {
      setEnCuotas?.(true);
      setCantidadCuotas?.(transaction.totalCuotas ?? 1);
    } else {
      setEnCuotas?.(false);
      setCantidadCuotas?.(1);
    }

    setShowModal(true);
  }, [setEditingTransaction, setFormData, setShowModal, setEnCuotas, setCantidadCuotas]);

  return handleEdit;
};
