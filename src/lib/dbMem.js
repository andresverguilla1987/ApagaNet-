// src/lib/dbMem.js
import { v4 as uuid } from "uuid";
export const mem = {
  users: [{ id: "u_demo", email: "demo@apaganet.app", name: "Demo", plan: "free", trialEndsAt: null }],
  devices: [],
  schedules: []
};
export const create = (table, obj) => {
  const id = uuid();
  const now = new Date().toISOString();
  mem[table].push({ id, createdAt: now, ...obj });
  return mem[table].find(x => x.id == id);
};
export const listBy = (table, where) => mem[table].filter(row =>
  Object.entries(where).every(([k, v]) => row[k] === v)
);
export const updateById = (table, id, patch) => {
  const idx = mem[table].findIndex(x => x.id === id);
  if (idx === -1) return null;
  mem[table][idx] = { ...mem[table][idx], ...patch, updatedAt: new Date().toISOString() };
  return mem[table][idx];
};
export const removeById = (table, id) => {
  const len = mem[table].length;
  mem[table] = mem[table].filter(x => x.id !== id);
  return mem[table].length < len;
};
