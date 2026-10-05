package th.ab.demo.todolist.integrationTest;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import th.ab.demo.todolist.Todo;
import th.ab.demo.todolist.TodoController;
import th.ab.demo.todolist.TodoRepository;
import org.springframework.ui.Model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;


@SpringBootTest
class TodolistIntegrationTests {

	@Autowired
	TodoController todoController;

	@Autowired
	TodoRepository todoRepository;


	@Test
	void deleteTodo() {
		Todo todo = todoRepository.save(new Todo(null,"TestDelete"));

		todoController.delete(todo.getId());

		assertThat(todoRepository.findById(todo.getId())).isEmpty();
	}

	@Test
	void addTodo() {
		Todo todo = new Todo(null, "TestAdd");

		todoController.add(todo);

		assertThat(todoRepository.findAll().stream().map(Todo::getText)).contains("TestAdd");
	}

	@Test
	void deleteNonExistingTodo(){
		todoController.delete(999L);
		assertThat(todoRepository.findById(999L)).isEmpty();
	}

	@Test
	void showTodos(){
		Model model = mock(Model.class);

		todoRepository.save(new Todo(null, "Study"));
		todoRepository.save(new Todo(null, "Shopping"));

		String viewName = todoController.showTodos(model);
		verify(model).addAttribute(eq("todos"), any());
		verify(model).addAttribute(eq("todo"), any(Todo.class));

		assertThat(viewName).isEqualTo("Todos");
	}

}
