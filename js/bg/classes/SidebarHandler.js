/* Copyright (c) 2012 Joel Thornton <sidewise@joelpt.net> See LICENSE.txt for license details. */

var SidebarHandler = function() {
  this.dockState = "undocked";
  this.targetWidth = 400;
  this.sidebarUrl = chrome.extension.getURL("sidebar.html");
  this.reset();
  log("Initialized SidebarHandler")
};
SidebarHandler.prototype = {
  reset: function() {
    this.dockWindowId = this.tabId = this.windowId = null;
    this.resetResizingDockWindowTimeout = this.removeInProgress = this.matchingMinimizedStates = this.resizingSidebar = this.resizingDockWindow = this.creatingSidebar = !1;
    this.sidebarPanes = {};
    this.currentSidebarMetrics = {};
    this.currentDockWindowMetrics = {};
    this.lastDockWindowMetrics = {}
  },
  registerSidebarPane: function(a, b) {
    this.sidebarPanes[a] = b
  },
  create: function(a) {
    if (this.sidebarExists()) throw Error("Cannot create() a new sidebar when one currently exists");
    log("Creating sidebar window/tab with target width " + this.targetWidth);
    this.creatingSidebar = !0;
    var b = this;
    if ("undocked" == this.dockState) chrome.windows.get(focusTracker.getFocused(), function(c) {
      var d = {
        url: "sidebar.html",
        type: "popup",
        width: b.targetWidth,
        height: settings.get("undockedHeight", Math.min(600, c.height - 100)),
        left: settings.get("undockedLeft", c.left + 100),
        top: settings.get("undockedTop", c.top + 100),
        focused: !1
      };
      chrome.windows.create(d, function(c) {
        chrome.windows.update(c.id, {
            left: d.left,
            top: d.top
          },
          function() {
            b.onCreatedSidebarWindow.call(b, c);
            a && a(c)
          })
      })
    });
    else {
      if (!this.dockWindowId) throw Error("No dockWindowId assigned for docking");
      chrome.windows.get(b.dockWindowId, function(c) {
        var c = b.fixMaximizedWinMetrics(c),
          d = b.getGoalDockMetrics(c, b.dockState, b.targetWidth);
        log("dock window metrics before creating sidebar", "targets", d, "win", c);
        b.lastDockWindowMetrics = {
          state: c.state,
          left: c.left,
          top: c.top,
          width: c.width,
          height: c.height
        };
        b.currentDockWindowMetrics = {
          state: "normal",
          left: d.dockWinLeft,
          top: c.top,
          width: d.dockWinWidth,
          height: c.height
        };
        if (c.state != "maximized") positionWindow(b.dockWindowId, b.currentDockWindowMetrics);
        var e = {
          url: "sidebar.html",
          type: "popup",
          left: d.sidebarLeft,
          top: c.top,
          width: b.targetWidth,
          height: c.height,
          focused: !1
        };
        log(e);
        chrome.windows.create(e, function(d) {
          chrome.windows.update(d.id, {
            top: e.top,
            height: e.height,
            left: e.left,
            width: e.width
          }, function() {
            b.onCreatedSidebarWindow.call(b, d);
            a && a(d)
          })
        })
      })
    }
  },
  createDockedToCurrentWin: function() {
    var a = this;
    focusTracker.getTopFocusableWindow(function(b) {
      a.dockWindowId =
        b ? b.id : focusTracker.getFocused();
      a.create()
    })
  },
  createWithDockState: function(a) {
    if (this.sidebarExists()) throw Error("Cannot createWithDockState() when sidebar already exists");
    this.dockState = a;
    "undocked" == a ? this.create() : this.createDockedToCurrentWin()
  },
  sidebarExists: function() {
    return this.tabId ? !0 : !1
  },
  remove: function(a) {
    if (!this.sidebarExists()) throw Error("Cannot remove sidebar it does not exist");
    var b = this;
    b.removeInProgress = !0;
    b.resizingDockWindow = !0;
    b.resizingSidebar = !0;
    chrome.tabs.remove(this.tabId,
      function() {
        b.onRemoved(a)
      })
  },
  onResize: function() {
    if (!("undocked" == this.dockState || this.resizingSidebar || this.removeInProgress || !this.windowId)) {
      var a = this;
      chrome.windows.get(a.windowId, function(b) {
        if (!(a.resizingSidebar || "maximized" == b.state && "Mac" != PLATFORM)) {
          var c = a.currentSidebarMetrics,
            d = b.width - c.width;
          if (0 != d) {
            var e = a.currentDockWindowMetrics;
            a.resizingDockWindow = !0;
            "right" == a.dockState && b.left != c.left ? e.width -= d : "left" == a.dockState && b.left == c.left && (e.width -= d, e.left += d);
            c.width = b.width;
            c.left =
              b.left;
            c.top = b.top;
            c.height = b.height;
            a.targetWidth = b.width;
            settings.set("sidebarTargetWidth", b.width);
            positionWindow(a.dockWindowId, {
              left: e.left,
              width: e.width
            }, function() {
              TimeoutManager.reset("resetResizingDockWindow", function() {
                a.resizingDockWindow = false
              }, 500)
            })
          }
        }
      })
    }
  },
  onRemoved: function(a) {
    if ("undocked" == this.dockState) this.reset(), a && a();
    else {
      var b = this.lastDockWindowMetrics,
        c = this;
      positionWindow(this.dockWindowId, {
        state: b.state,
        left: b.left,
        width: b.width,
        top: b.top,
        height: b.height
      }, function() {
        c.reset();
        a && a()
      })
    }
  },
  redock: function(a, b) {
    if (a) {
      if (!this.sidebarExists()) throw Error("Cannot redock a nonexistent sidebar");
      if ("undocked" == this.dockState) b && b();
      else {
        var c = this;
        this.dockWindowId && positionWindow(this.dockWindowId, this.lastDockWindowMetrics);
        this.dockWindowId = a;
        chrome.windows.get(a, function(a) {
          "Mac" != PLATFORM && (a = c.fixMaximizedWinMetrics(a));
          var e = c.getGoalDockMetrics(a, c.dockState, c.targetWidth);
          log(e);
          c.lastDockWindowMetrics = {
            state: a.state,
            left: a.left,
            top: a.top,
            width: a.width,
            height: a.height
          };
          c.currentDockWindowMetrics = {
            state: "normal",
            left: e.dockWinLeft,
            top: a.top,
            width: e.dockWinWidth,
            height: a.height
          };
          positionWindow(c.dockWindowId, c.currentDockWindowMetrics);
          a = {
            left: e.sidebarLeft,
            top: a.top,
            width: c.targetWidth,
            height: a.height
          };
          c.currentSidebarMetrics = a;
          log(a);
          positionWindow(c.windowId, a, function() {
            chrome.windows.update(c.windowId, {
              focused: !0
            }, function() {
              chrome.windows.update(c.dockWindowId, {
                focused: !0
              }, function() {
                b && b()
              })
            })
          })
        })
      }
    } else b && b()
  },
  focus: function(a) {
    if (!this.windowId) throw Error("Cannot focus nonexistent sidebar");
    chrome.windows.update(this.windowId, {
      focused: !0
    }, function() {
      a && a()
    })
  },
  blur: function(a) {
    if (this.windowId) {
      var b = this;
      focusTracker.getTopFocusableWindow(function(c) {
        chrome.windows.update(c.id || b.dockWindowId, {
          focused: !0
        }, function() {
          a && a()
        })
      })
    } else log("Cannot blur nonexistent sidebar")
  },
  fixMaximizedWinMetrics: function(a) {
    "maximized" == a.state && "Mac" != PLATFORM && (a.left += monitorInfo.maximizedOffset, a.top += monitorInfo.maximizedOffset, a.width -= 2 * monitorInfo.maximizedOffset, a.height -= 2 * monitorInfo.maximizedOffset);
    return a
  },
  getGoalDockMetrics: function(a, b, c) {
    var d = monitorInfo.monitors,
      e = d.reduce(function(a, b) {
        return 0 > b.left ? a - b.left : a
      }, 0);
    log(e);
    var f = a.left,
      a = a.width,
      k = 0,
      j = 0,
      h, g = 0,
      i;
    for (i in d) {
      g += d[i].width;
      j = parseInt(i);
      h = d[i].width;
      if (f + e < g) break;
      k += d[i].width
    }
    i = d[j].marginLeft;
    g = d[j].marginRight;
    log("beliefs about monitors:", d);
    log("current monitor", j, d[j]);
    log("currentMonitorWidth", h);
    log("primaryLeftOffset", e);
    d = f + e - k - i;
    j = Math.max(0, h - a - d - i - g);
    log("free on left", d);
    log("free on right", j);
    var l = f + e -
      k - i,
      f = l + a,
      m = h - i - g;
    log("effectiveLeft", l);
    log("effectiveRight", f);
    log("effectiveMonitorWidth", m);
    h = l;
    g = f;
    if ("left" == b) d < c && (h += c - d, g += c - d, g > m && (g = m));
    else if ("right" == b) j < c && (h -= c - j, g -= c - j, 0 > h && (h = 0));
    else throw Error("Unrecognized side parameter: " + b);
    log("newLeft", h);
    log("newRight", g);
    d = h - l;
    f = g - (f + d);
    log("adjustWinLeft", d);
    log("adjustWinWidth", f);
    f = a + f;
    log("winWidth", a);
    log("newWidth", f);
    return {
      sidebarLeft: ("left" == b ? h - c : g) + i + k - e,
      dockWinLeft: h + i + k - e,
      dockWinWidth: f
    }
  },
  onCreatedSidebarWindow: function(a) {
    log(a);
    this.windowId = a.id;
    this.tabId = a.tabs[0].id;
    this.currentSidebarMetrics = {
      left: a.left,
      top: a.top,
      width: a.width,
      height: a.height,
      state: "normal"
    };
    this.creatingSidebar = !1;
    "undocked" == this.dockState && (settings.set("undockedTop", a.top), settings.set("undockedLeft", a.left), settings.set("undockedHeight", a.height))
  },
  matchSidebarDockMinimizedStates: function(a) {
    if ("undocked" == this.dockState || !this.dockWindowId || !this.windowId) a && a(!1);
    else if (this.matchingMinimizedStates) a && a(!1);
    else {
      var b = this.currentSidebarMetrics.state,
        c = this.currentDockWindowMetrics.state,
        d = this;
      setTimeout(function() {
        !d.dockWindowId || !d.windowId ? a && a(!1) : chrome.windows.get(d.dockWindowId, function(e) {
          !e || !d.windowId ? a && a(!1) : chrome.windows.get(d.windowId, function(f) {
            !e || !f ? a && a(!1) : d.matchingMinimizedStates ? a && a(!1) : (d.currentSidebarMetrics.state = f.state, d.currentDockWindowMetrics.state = e.state, "minimized" == f.state && "minimized" != b && "minimized" != c ? (d.matchingMinimizedStates = !0, chrome.windows.update(e.id, {
                state: "minimized"
              }, function() {
                d.currentDockWindowMetrics.state =
                  "minimized";
                d.matchingMinimizedStates = !1;
                a && a(!0)
              })) : "minimized" != f.state && "minimized" == b && "minimized" == c ? (d.matchingMinimizedStates = !0, chrome.windows.update(e.id, {
                state: "normal"
              }, function() {
                d.currentDockWindowMetrics.state = "normal";
                d.matchingMinimizedStates = !1;
                a && a(!0)
              })) : "minimized" == e.state && "minimized" != c && "minimized" != b ? (d.matchingMinimizedStates = !0, chrome.windows.update(f.id, {
                state: "minimized"
              }, function() {
                d.currentSidebarMetrics.state = "minimized";
                d.matchingMinimizedStates = !1;
                a && a(!0)
              })) : "minimized" !=
              e.state && "minimized" == c && "minimized" == b ? (d.matchingMinimizedStates = !0, chrome.windows.update(f.id, {
                state: "normal"
              }, function() {
                chrome.windows.update(e.id, {
                  focused: !0
                }, function() {
                  d.currentSidebarMetrics.state = "normal";
                  d.matchingMinimizedStates = !1;
                  a && a(!0)
                })
              })) : a && a(!1))
          })
        })
      }, 50)
    }
  },
  getIdealNewWindowMetrics: function() {
    var a;
    "undocked" != this.dockState ? (a = clone(this.currentDockWindowMetrics), delete a.state) : (a = monitorInfo.getMonitorFromLeftCoord(this.currentSidebarMetrics.left), a = {
      left: a.left,
      top: a.top,
      width: a.availWidth,
      height: a.availHeight
    });
    return a
  }
};
