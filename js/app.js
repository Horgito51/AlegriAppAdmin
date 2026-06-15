import { dataClient, tables } from "./api/client.js";
import { profesoresApi } from "./api/profesoresApi.js";
import { cursosApi } from "./api/cursosApi.js";
import { materiasApi } from "./api/materiasApi.js";
import { createProfesoresModule } from "./modules/profesores.js";
import { createCursosModule } from "./modules/cursos.js";
import { createMateriasModule } from "./modules/materias.js";
import { createAsignacionesModule } from "./modules/asignaciones.js";

const pageTitle = document.getElementById("page-title");
const dataMode = document.getElementById("data-mode");
const toast = document.getElementById("toast");

let toastTimer = null;

function notify(message, type = "neutral") {
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

    document.getElementById("metric-profesores").textContent = profesores.length;
    document.getElementById("metric-cursos").textContent = cursos.length;
    document.getElementById("metric-materias").textContent = materias.length;
    document.getElementById("metric-asignaciones").textContent = asignacionesCurso.length + asignacionesMateria.length;
  } catch (error) {
    notify(error.message, "error");
  }
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
  pageTitle.textContent = section?.dataset.title || "Panel administrativo";
}

function bindNavigation() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => showSection(item.dataset.section));
  });
}

async function init() {
  dataMode.textContent = `Modo datos: ${dataClient.modeLabel}`;
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
