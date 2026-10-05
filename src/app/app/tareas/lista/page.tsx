import { requirePageUser } from "@/core/auth/session";
import { TodoList } from "@/modules/tareas/components/todo-list";
import { listTodos } from "@/modules/tareas/server/todos-repository";

export default async function TodosPage() {
  const user = await requirePageUser();

  return <TodoList initialTodos={await listTodos(user.id)} />;
}
