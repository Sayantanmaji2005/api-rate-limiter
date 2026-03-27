package com.apiratelimiter.config;

import java.awt.Desktop;
import java.awt.GraphicsEnvironment;
import java.net.URI;
import java.util.Arrays;
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

    if (GraphicsEnvironment.isHeadless()) {
      return;
    }

    if (!Desktop.isDesktopSupported()) {
      return;
    }

    Desktop desktop = Desktop.getDesktop();
    if (!desktop.isSupported(Desktop.Action.BROWSE)) {
      return;
    }

    String port = environment.getProperty("local.server.port");
    if (port == null || port.isBlank()) {
      port = environment.getProperty("server.port", "5001");
    }

    String path = normalizePath(appProperties.getStartupPage());
    String targetUrl = "http://localhost:" + port + path;

    try {
      desktop.browse(URI.create(targetUrl));
      LOGGER.info("Opened browser: {}", targetUrl);
    } catch (Exception ex) {
      LOGGER.warn("Could not auto-open browser at {}", targetUrl);
    }
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
}
