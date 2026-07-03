# Optional Vaadin UI Path

This project is now fully Java using Spring Boot + Thymeleaf.

If you also want a Vaadin UI (Option 2), add these steps:

1. Add dependency to `pom.xml`:

```xml
<dependency>
  <groupId>com.vaadin</groupId>
  <artifactId>vaadin-spring-boot-starter</artifactId>
  <version>24.5.8</version>
</dependency>
```

2. Create a route class:

```java
@Route("vaadin-dashboard")
public class VaadinDashboardView extends VerticalLayout {
  public VaadinDashboardView() {
    add(new H2("RateLimiter Pro - Vaadin"));
  }
}
```

3. Run:

```bash
mvn spring-boot:run
```

Then open:
- `http://localhost:5001/vaadin-dashboard`
