import { useState, useEffect } from "react";
import { Plus, Edit2, Archive, RotateCcw, Lock, ChevronDown, ChevronRight } from "lucide-react";
import {
  getCategories,
  getArchivedCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  restoreCategory,
} from "../services/categoriesService";
import { parseApiDate } from "../utils/date";

const EMOJI_LIST = ["🍔", "🚗", "🎮", "🏥", "📚", "🏠", "👕", "💡", "📱", "🐾", "🎁", "📦", "💰", "💼", "📈", "🛒", "✈️", "🎯", "⚡", "🔧"];

export default function CategoriesSettings({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("system");
  const [categories, setCategories] = useState([]);
  const [archivedCategories, setArchivedCategories] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState({ name: "", type: "gasto", parentCategoryId: null, icon: "", color: "" });
  const [error, setError] = useState("");
  const [expandedParents, setExpandedParents] = useState({});

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, activeTab]);

  const loadData = async () => {
    try {
      const all = await getCategories();
      setCategories(all);

      const archived = await getArchivedCategories();
      setArchivedCategories(archived);
    } catch (err) {
      setError(err.response?.data || "Error al cargar categorías");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) return;

    try {
      await createCategory({
        name: form.name.trim(),
        type: form.type,
        parentCategoryId: form.parentCategoryId || null,
        icon: form.icon || null,
        color: form.color || null,
      });
      setForm({ name: "", type: "gasto", parentCategoryId: null, icon: "", color: "" });
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data || "Error al crear categoría");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !editingCategory) return;

    try {
      await updateCategory(editingCategory.id, {
        id: editingCategory.id,
        name: form.name.trim(),
        type: form.type,
        parentCategoryId: form.parentCategoryId || null,
        icon: form.icon || editingCategory.icon,
        color: form.color || editingCategory.color,
      });
      setEditingCategory(null);
      setForm({ name: "", type: "gasto", parentCategoryId: null, icon: "", color: "" });
      loadData();
    } catch (err) {
      setError(err.response?.data || "Error al actualizar categoría");
    }
  };

  const handleArchive = async (id) => {
    try {
      await archiveCategory(id);
      loadData();
    } catch (err) {
      setError(err.response?.data || "Error al archivar categoría");
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreCategory(id);
      loadData();
    } catch (err) {
      setError(err.response?.data || "Error al restaurar categoría");
    }
  };

  const startEdit = (cat) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name,
      type: cat.type,
      parentCategoryId: cat.parentCategoryId,
      icon: cat.icon || "",
      color: cat.color || "",
    });
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setForm({ name: "", type: "gasto", parentCategoryId: null, icon: "", color: "" });
  };

  const toggleParent = (id) => {
    setExpandedParents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const userCategories = categories.filter(c => !c.isSystem);
  const systemCategories = categories.filter(c => c.isSystem);

  const parentCategories = userCategories.filter(c => !c.parentCategoryId);
  const getChildCategories = (parentId) => userCategories.filter(c => c.parentCategoryId === parentId);

  const availableParents = userCategories.filter(c => !c.isArchived && !c.parentCategoryId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Categorías</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("system")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "system"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <Lock className="w-4 h-4 inline mr-1" /> Sistema
          </button>
          <button
            onClick={() => setActiveTab("personal")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "personal"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            Mis categorías
          </button>
          <button
            onClick={() => setActiveTab("archived")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "archived"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <Archive className="w-4 h-4 inline mr-1" /> Archivadas
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{typeof error === "string" ? error : JSON.stringify(error)}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "system" && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Categorías globales del sistema. No se pueden editar ni eliminar.
              </p>
              {systemCategories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    {cat.icon && <span>{cat.icon}</span>}
                    <span className="font-medium text-gray-800 dark:text-white">{cat.name}</span>
                    <span className="text-xs text-gray-400">({cat.type})</span>
                  </div>
                  <Lock className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          )}

          {activeTab === "personal" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tus categorías personales. Podés crear, editar y archivar.
                </p>
                <button
                  onClick={() => {
                    setEditingCategory(null);
                    setForm({ name: "", type: "gasto", parentCategoryId: null, icon: "", color: "" });
                    setShowCreateModal(true);
                  }}
                  className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" /> Nueva
                </button>
              </div>

              <div className="space-y-2">
                {parentCategories.length === 0 && (
                  <p className="text-center text-gray-400 py-8">No tenés categorías personales aún.</p>
                )}
                {parentCategories.map(parent => {
                  const children = getChildCategories(parent.id);
                  const isExpanded = expandedParents[parent.id];
                  return (
                    <div key={parent.id}>
                      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          {children.length > 0 && (
                            <button onClick={() => toggleParent(parent.id)} className="text-gray-400 hover:text-gray-600">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                          {parent.icon && <span>{parent.icon}</span>}
                          <span className="font-medium text-gray-800 dark:text-white">{parent.name}</span>
                          <span className="text-xs text-gray-400">({parent.type})</span>
                          {children.length > 0 && (
                            <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">{children.length}</span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(parent)} className="text-blue-600 hover:text-blue-800 p-1">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleArchive(parent.id)} className="text-red-600 hover:text-red-800 p-1">
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {isExpanded && children.length > 0 && (
                        <div className="ml-8 mt-1 space-y-1">
                          {children.map(child => (
                            <div key={child.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">└</span>
                                {child.icon && <span>{child.icon}</span>}
                                <span className="text-gray-700 dark:text-gray-300">{child.name}</span>
                                <span className="text-xs text-gray-400">({child.type})</span>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => startEdit(child)} className="text-blue-600 hover:text-blue-800 p-1">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleArchive(child.id)} className="text-red-600 hover:text-red-800 p-1">
                                  <Archive className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "archived" && (
            <div className="space-y-2">
              {archivedCategories.length === 0 && (
                <p className="text-center text-gray-400 py-8">No hay categorías archivadas.</p>
              )}
              {archivedCategories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg opacity-60">
                  <div className="flex items-center gap-2">
                    {cat.icon && <span>{cat.icon}</span>}
                    <span className="text-gray-600 dark:text-gray-400">{cat.name}</span>
                    <span className="text-xs text-gray-400">({cat.type})</span>
                    {cat.archivedAt && (
                      <span className="text-xs text-gray-400">
                        archivada el {parseApiDate(cat.archivedAt).toLocaleDateString("es-AR")}
                      </span>
                    )}
                  </div>
                  <button onClick={() => handleRestore(cat.id)} className="text-green-600 hover:text-green-800 p-1">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {(showCreateModal || editingCategory) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                {editingCategory ? "Editar categoría" : "Nueva categoría"}
              </h3>
              <form onSubmit={editingCategory ? handleUpdate : handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder="Nombre de la categoría"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="gasto">Gasto</option>
                    <option value="ingreso">Ingreso</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría padre (opcional)</label>
                  <select
                    value={form.parentCategoryId || ""}
                    onChange={e => setForm({ ...form, parentCategoryId: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Sin padre (categoría principal)</option>
                    {availableParents
                      .filter(p => !editingCategory || p.id !== editingCategory.id)
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icono</label>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, icon: "" })}
                      className={`w-8 h-8 rounded ${!form.icon ? "bg-blue-100 border-2 border-blue-500" : "border border-gray-200"}`}
                    >
                      ✕
                    </button>
                    {EMOJI_LIST.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setForm({ ...form, icon: emoji })}
                        className={`w-8 h-8 rounded text-lg ${form.icon === emoji ? "bg-blue-100 border-2 border-blue-500" : "border border-gray-200"}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
                  <input
                    type="color"
                    value={form.color || "#3b82f6"}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-12 h-8 rounded cursor-pointer"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      cancelEdit();
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingCategory ? "Guardar" : "Crear"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
