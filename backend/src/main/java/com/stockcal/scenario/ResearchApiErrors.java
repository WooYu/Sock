package com.stockcal.scenario;
import java.time.DateTimeException;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestControllerAdvice(assignableTypes={ScenarioRecordController.class,NoteStudyController.class,LearningSampleController.class})
public class ResearchApiErrors {
    @ExceptionHandler({IllegalArgumentException.class,DateTimeException.class})
    ResponseEntity<Map<String,String>> invalid(RuntimeException e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()==null?"研究请求格式无效":e.getMessage()));}
}
