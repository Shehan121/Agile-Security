package th.ab.demo.todolist;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;


@Controller
@RequestMapping
public class TodoController {

    @Autowired
    protected TodoRepository repository;

    @GetMapping
    public String showTodos(Model model) {
        model.addAttribute("todos", repository.findAll());
        model.addAttribute("todo", new Todo() );
        return "Todos";
    }

    @GetMapping("/delete")
    public String delete(@RequestParam(value = "id") Long id) {
        if(repository.existsById(id)) {
            repository.deleteById(id);
        }
        return "redirect:/";
    }

    @PostMapping("/add")
    public String add(@ModelAttribute Todo todo) {
        repository.save(todo);
        return "redirect:/";
    }

}
