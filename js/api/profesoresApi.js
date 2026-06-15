import { dataClient, tables } from "./client.js?v=20260614-4";

const table = tables.profesores;

export const profesoresApi = {
  list() {
    return dataClient.list(table, { order: ["apellidos", "nombres"] });
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
