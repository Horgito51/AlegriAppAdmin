import { dataClient, tables } from "./client.js?v=20260614-2";

const table = tables.cursos;

export const cursosApi = {
  list() {
    return dataClient.list(table, { order: ["nombre", "paralelo"] });
  },
  create(payload) {
    return dataClient.create(table, payload);
  },
  update(id, payload) {
    return dataClient.update(table, id, payload);
  },
  remove(id) {
    return dataClient.remove(table, id);
  },
};
