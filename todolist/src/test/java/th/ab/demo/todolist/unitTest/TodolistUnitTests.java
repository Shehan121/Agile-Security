package th.ab.demo.todolist.unitTest;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import th.ab.demo.todolist.Todo;
import th.ab.demo.todolist.TodoController;
import th.ab.demo.todolist.TodoRepository;
import org.springframework.ui.Model;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TodolistUnitTests {

	@Mock
	TodoRepository todoRepository;

	@InjectMocks
	TodoController todoController = new TodoController();

	@Test
	void deleteTodo() {
		when(todoRepository.existsById(any())).thenReturn(true);

		todoController.delete(5L);

		verify(todoRepository).deleteById(5L);
	}

	@Test
	void addTodo() {
		Todo todo = new Todo(4L, "Test");
		todoController.add(todo);

		verify(todoRepository).save(todo);
	}

	@Test
	void deleteTodoNotExists(){
		when(todoRepository.existsById(any())).thenReturn(false);
		todoController.delete(5L);
		verify(todoRepository, never()).deleteById(any());
	}

	@Test
	void showTodos(){
		Model model = mock(Model.class);
		todoController.showTodos(model);

		verify(todoRepository).findAll();
		verify(model).addAttribute(eq("todos"), any());
		verify(model).addAttribute(eq("todo"), any(Todo.class));
	}

}
