package com.limitr.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    @GetMapping(value = {"/", "/login", "/dashboard", "/traffic", "/logs", "/incidents", "/rules"})
    public String forward() {
        return "forward:/index.html";
    }
}
