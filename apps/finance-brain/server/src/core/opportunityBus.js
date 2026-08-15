import { EventEmitter } from 'node:events';
export const opportunityBus = new EventEmitter();
opportunityBus.setMaxListeners(50);
