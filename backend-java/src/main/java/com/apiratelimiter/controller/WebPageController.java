package com.apiratelimiter.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class WebPageController {

  @GetMapping("/")
  public String root() {
    return "redirect:/dashboard";
  }

  @GetMapping("/login")
  public String loginPage() {
    return "login";
  }

  @GetMapping("/register")
  public String registerPage() {
    return "register";
  }

  @GetMapping("/dashboard")
  public String dashboardPage() {
    return "dashboard";
  }

  @GetMapping("/admin")
  public String adminPage() {
    return "admin";
  }
}
