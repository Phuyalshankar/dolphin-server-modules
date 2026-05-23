import { createCrudController } from 'dolphin-server-modules/crud';

export default class TaskController extends createCrudController {
  constructor(server, model) {
    super(server, model);
  }
}