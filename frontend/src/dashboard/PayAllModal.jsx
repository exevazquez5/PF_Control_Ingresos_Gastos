import React from 'react';
import { X, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import formatCurrency from '../utils/format.js';
import { parseApiDate } from '../utils/date';

export default function PayAllModal({ cuotas, selMonth, onClose, onConfirm }) {
    const totalAPagar = cuotas.reduce((sum, c) => sum + c.montoCuota, 0);
    const [loading, setLoading] = React.useState(false);

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await onConfirm();
        } finally {
            setLoading(false);
        }
    };

    const monthLabel = selMonth.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fadeIn">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                        <Clock className="w-5 h-5 text-orange-500" />
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                            Cuotas Pendientes - {monthLabel}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Body - scrollable */}
                <div className="overflow-y-auto flex-1 p-6 space-y-4">
                    {cuotas.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <p>No hay cuotas pendientes para este mes.</p>
                        </div>
                    ) : (
                        cuotas.map((cuota) => {
                            const totalCuotas = cuota.totalCuotas ?? 0;
                            const pagadas = cuota.pagadas ?? (totalCuotas - (cuota.restantes ?? 0));
                            const progreso = totalCuotas > 0
                                ? Math.round((pagadas / totalCuotas) * 100)
                                : 0;

                            return (
                                <div key={cuota.id} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Info */}
                                    <div className="bg-orange-50 dark:bg-gray-700 rounded-lg p-4 shadow-sm border border-orange-200 dark:border-gray-600 flex flex-col">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <AlertCircle className="w-4 h-4 text-orange-500" />
                                            <span className="font-medium text-gray-800 dark:text-white">{cuota.descripcionGasto}</span>
                                            <span className="bg-orange-100 dark:bg-gray-500 text-orange-800 dark:text-gray-200 px-2 py-1 rounded-full text-xs">
                                                {cuota.categoria}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-300">
                                            Cuota {cuota.nroCuota} - Vence: {parseApiDate(cuota.dueDate).toLocaleDateString('es-AR')}
                                        </div>
                                        <div className="text-lg font-semibold text-orange-600 dark:text-orange-400 mt-1">
                                            {formatCurrency(cuota.montoCuota)}
                                        </div>
                                    </div>

                                    {/* Progreso */}
                                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 shadow-sm flex flex-col">
                                        <h5 className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Progreso de Pago</h5>
                                        <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2 mb-2">
                                            <div
                                                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${progreso}%` }}
                                            ></div>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-300">
                                            Pagadas: <strong>{pagadas}</strong> / {totalCuotas}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-300">
                                            Pendientes: <strong>{cuota.restantes}</strong>
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-2xl">
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total a pagar</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalAPagar)}</p>
                    </div>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || cuotas.length === 0}
                        className="bg-green-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                                <span>Procesando...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                <span>Pagar Todo</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
