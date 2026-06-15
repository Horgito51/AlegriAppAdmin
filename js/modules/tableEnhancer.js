const labels = {
  placeholder: "Buscar...",
  searchTitle: "Buscar en la tabla",
  perPage: "por pagina",
  noRows: "No hay datos disponibles",
  noResults: "No se encontraron resultados",
  info: "Mostrando {start} a {end} de {rows} registros",
};

export function createTableEnhancer() {
  let instance = null;

  function hasConsistentColumns(table) {
    const headings = table?.querySelectorAll("thead th") || [];
    const rows = table?.querySelectorAll("tbody tr") || [];
    if (!headings.length) return false;
    if (!rows.length) return false;

    return Array.from(rows).every((row) => row.querySelectorAll("td").length === headings.length);
  }

  function normalizePerPageLabel(table) {
    const label = table?.closest(".datatable-wrapper")?.querySelector(".datatable-dropdown label");
    const select = label?.querySelector("select");
    if (!label || !select) return;

    label.childNodes.forEach((node) => {
      if (node !== select) node.remove();
    });

    const text = document.createElement("span");
    text.textContent = "por pagina";
    label.append(text);
  }

  function destroy() {
    if (instance) {
      instance.destroy();
      instance = null;
    }
  }

  function mount(table, options = {}) {
    destroy();
    if (!table || !window.simpleDatatables?.DataTable) return;
    if (!hasConsistentColumns(table)) return;
    try {
      instance = new window.simpleDatatables.DataTable(table, {
        searchable: true,
        sortable: true,
        fixedHeight: false,
        perPage: 6,
        perPageSelect: [6, 10, 15, 25],
        labels,
        ...options,
      });
      normalizePerPageLabel(table);
    } catch (error) {
      instance = null;
      console.warn("No se pudo inicializar simple-datatables:", error);
    }
  }

  return { destroy, mount };
}
