import { dataClient, tables } from "./api/client.js?v=20260614-4";
import { profesoresApi } from "./api/profesoresApi.js?v=20260614-4";
import { cursosApi } from "./api/cursosApi.js?v=20260614-4";
import { materiasApi } from "./api/materiasApi.js?v=20260614-4";
import { createProfesoresModule } from "./modules/profesores.js?v=20260614-4";
import { createCursosModule } from "./modules/cursos.js?v=20260614-4";
import { createMateriasModule } from "./modules/materias.js?v=20260614-4";
import { createAsignacionesModule } from "./modules/asignaciones.js?v=20260614-4";

const pageTitle = document.getElementById("page-title");
const toast = document.getElementById("toast");

let toastTimer = null;

function notify(message, type = "neutral") {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

async function refreshMetrics() {
  try {
    const [profesores, cursos, materias, asignacionesCurso, asignacionesMateria] = await Promise.all([
      profesoresApi.list(),
      cursosApi.list(),
      materiasApi.list(),
      dataClient.list(tables.docenteCurso),
      dataClient.list(tables.docenteMateria),
    ]);

    setMetric("metric-profesores", profesores.length);
    setMetric("metric-cursos", cursos.length);
    setMetric("metric-materias", materias.length);
    setMetric("metric-asignaciones", asignacionesCurso.length + asignacionesMateria.length);
  } catch (error) {
    notify(error.message, "error");
  }
}

function setMetric(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

const modules = {};

function buildModules() {
  const onChange = () => {
    refreshMetrics();
    modules.asignaciones?.refresh();
  };

  modules.profesores = createProfesoresModule({ notify, onChange });
  modules.cursos = createCursosModule({ notify, onChange });
  modules.materias = createMateriasModule({ notify, onChange });
  modules.asignaciones = createAsignacionesModule({ notify, onChange: refreshMetrics });
}

function showSection(sectionId) {
  document.querySelectorAll(".page-section").forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.section === sectionId);
  });

  const section = document.getElementById(sectionId);
  if (pageTitle) pageTitle.textContent = section?.dataset.title || "Panel administrativo";
}

function bindNavigation() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => showSection(item.dataset.section));
  });

  document.querySelectorAll("[data-section-shortcut]").forEach((item) => {
    item.addEventListener("click", () => showSection(item.dataset.sectionShortcut));
  });
}

async function init() {
  buildModules();
  bindNavigation();
  await Promise.all([
    modules.profesores.init(),
    modules.cursos.init(),
    modules.materias.init(),
    modules.asignaciones.init(),
  ]);
  await refreshMetrics();
}

init().catch((error) => notify(error.message, "error"));
