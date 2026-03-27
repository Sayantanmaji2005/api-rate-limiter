package com.apiratelimiter.config;

import java.awt.Desktop;
import java.awt.GraphicsEnvironment;
import java.net.URI;
import java.util.Arrays;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.boot.context.event.ApplicationReadyEvent;

@Component
public class BrowserStartupLauncher {

  private static final Logger LOGGER = LoggerFactory.getLogger(BrowserStartupLauncher.class);

  private final AppProperties appProperties;
  private final Environment environment;

  public BrowserStartupLauncher(AppProperties appProperties, Environment environment) {
    this.appProperties = appProperties;
    this.environment = environment;
  }

  @EventListener(ApplicationReadyEvent.class)
  public void openBrowserOnStartup() {
    if (!appProperties.isOpenBrowserOnStartup()) {
      return;
    }

    if (Arrays.asList(environment.getActiveProfiles()).contains("test")) {
      return;
    }

    String port = environment.getProperty("local.server.port");
    if (port == null || port.isBlank()) {
      port = environment.getProperty("server.port", "5001");
    }

    String path = normalizePath(appProperties.getStartupPage());
    String targetUrl = "http://localhost:" + port + path;

    if (tryDesktopBrowse(targetUrl) || tryOsCommand(targetUrl)) {
      LOGGER.info("Opened browser: {}", targetUrl);
      return;
    }

    LOGGER.warn("Could not auto-open browser at {}", targetUrl);
  }

  private String normalizePath(String path) {
    if (path == null || path.isBlank()) {
      return "/dashboard";
    }
    if (path.startsWith("/")) {
      return path;
    }
    return "/" + path;
  }

  private boolean tryDesktopBrowse(String targetUrl) {
    if (GraphicsEnvironment.isHeadless()) {
      return false;
    }
    if (!Desktop.isDesktopSupported()) {
      return false;
    }
    Desktop desktop = Desktop.getDesktop();
    if (!desktop.isSupported(Desktop.Action.BROWSE)) {
      return false;
    }
    try {
      desktop.browse(URI.create(targetUrl));
      return true;
    } catch (Exception ignored) {
      return false;
    }
  }

  private boolean tryOsCommand(String targetUrl) {
    String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
    ProcessBuilder processBuilder;

    if (os.contains("win")) {
      processBuilder = new ProcessBuilder("cmd", "/c", "start", "\"\"", targetUrl);
    } else if (os.contains("mac")) {
      processBuilder = new ProcessBuilder("open", targetUrl);
    } else {
      processBuilder = new ProcessBuilder("xdg-open", targetUrl);
    }

    try {
      processBuilder.start();
      return true;
    } catch (Exception ignored) {
      return false;
    }
  }
}
