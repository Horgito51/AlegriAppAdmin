import { dataClient, tables } from "./client.js?v=20260614-2";

const table = tables.materias;

export const materiasApi = {
  list() {
    return dataClient.list(table, { order: ["nombre"] });
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
