const labels = {
  placeholder: "Buscar...",
  searchTitle: "Buscar en la tabla",
  perPage: "{select} por pagina",
  noRows: "No hay datos disponibles",
  noResults: "No se encontraron resultados",
  info: "Mostrando {start} a {end} de {rows} registros",
};

export function createTableEnhancer() {
  let instance = null;

  function destroy() {
    if (instance) {
      instance.destroy();
      instance = null;
    }
  }

  function mount(table) {
    destroy();
    if (!table || !window.simpleDatatables?.DataTable) return;
    instance = new window.simpleDatatables.DataTable(table, {
      searchable: true,
      sortable: true,
      fixedHeight: false,
      perPage: 6,
      perPageSelect: [6, 10, 15, 25],
      labels,
    });
  }

  return { destroy, mount };
}
