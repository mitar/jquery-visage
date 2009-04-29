/*
 * Mitar <mitar@tnode.com>
 * http://mitar.tnode.com/
 * In kind public domain.
 *
 * $Id$
 * $Revision$
 * $HeadURL$
*/

(function ($) {
	$.VisageClass = function (options) {
		this.construct(options);
	};
	
	$.initVisage = function (options) {
		if (typeof $.Visage == "undefined") {
			$.Visage = new $.VisageClass(options);
		}
		else {
			$.Visage.warn("Reinitializing already initialized Visage, ignoring");
		}
	}
	
	// Default options: {"start": false, "events": true} (do not autostart and do register events)
	$.fn.visage = function (options) {
		if (typeof $.Visage == "undefined") {
			throw "Use of an uninitialized Visage";
		}

		if ($.Visage.unsupported) {
			return this;
		}
		
		if (this.length == 0) {
			$.Visage.warn("Use of Visage on an empty group of elements");
			return this;
		}
		
		options = $.extend({"start": false, "events": true}, options);

		// Group of elements we are calling visage on
		var group = this;

		if (options.events) {
			group.unbind().click(function (event) {
				event.preventDefault();
				$.Visage.start(group.index(this), group);
				return false;
			});

			group.addClass("visage-enabled");
		}
		
		if (options.start) {
			$.Visage.start(0, group);
		}

		return this;
	};
	
	$.extend($.VisageClass.prototype, {
		"config": {
			"keys": {
				"prev": "p",
				"next": "n",
				"close": "c",
				"first": "f",
				"last": "l"
			},
			"text": {
				"prev": "Previous",
				"next": "Next",
				"close": "Close",
				"countOpening": "Image ",
				"countOf": " of ",
				"countClosing": "",
				"error": "Error displaying the image"
			},
			"files": {
				"blank": "./res/blank.gif",
				"error": "./res/error.png"
			},
			"opacity": 0.9,
			"speed": 300, // in milliseconds
			"loadingWait": 100, // in milliseconds
			"relify": ["visage"],
			"border": 1, // in pixels
			"maxSize": 80 // in percents
		},
		
		"unsupported": false,
		"image": null,
		"images": null,
		"loadingTimeout": null,
		"busy": 0,
		"stopping": false,
		
		"construct": function (options) {
			this.busy++;
			
			$.extend(true, this.config, options);
			
			// TODO Add workarounds if possible for unsupported browsers 
			if ($.browser.msie && (parseInt($.browser.version) < 7)) {
				this.unsupported = true;
			}
			
			if (this.unsupported) {
				this.warn("Unsupported browser, will not use Visage");
				
				this.busy--;
				return;
			}
			
			this.busy++;
			$(document).ready(function () {
				$.Visage.documentReady();
				$.Visage.busy--;
			});
			
			this.busy--;
		},
		
		"documentReady": function () {
			$.Visage.busy++;
			
			$("#visage,#visage-overlay").remove();
			$("body").append(
				'<div id="visage-overlay">'
					+ '<div id="visage-close" title="' + $.Visage.config.text.close + '"></div>' +
				'</div>' +
				'<div id="visage">' +
					'<div id="visage-image-contain"><img src="' + $.Visage.config.files.blank + '" id="visage-image" alt="" title=""></div>' +
					'<div id="visage-nav-prev" title="' + $.Visage.config.text.prev + '"></div>' +
					'<div id="visage-nav-next" title="' + $.Visage.config.text.next + '"></div>' +
					'<div id="visage-count"></div>' +
					'<div id="visage-title"></div>' +
				'</div>'
			);
			$("#visage,#visage-overlay,#visage-nav-prev,#visage-nav-next").hide();
			
			$("#visage-overlay,#visage-close").unbind().click(function (event) {
				event.preventDefault();
				$.Visage.stop();
				return false;
			});
			
			$("#visage-nav-prev,#visage-nav-next").unbind();
			
			$(window).resize(function () {
				$.Visage.resize();
			});
			
			$(document).keyup(function (event) {
				if ($.Visage.keyup(event)) {
					event.preventDefault();
					return false;
				}
				else {
					return true;
				}
			});
			
			$.each($.Visage.config.relify, function (i, rel) {
				var groups = {};
				$("[rel^=" + rel + "]").each(function (i) {
					var r = this.attr("rel");
					if (typeof groups[r] == "undefined") {
						groups[r] = [];
					}
					groups[r].push(this);
				});
	
				$.each(groups, function (i, group) {
					$(group).visage();
				});
			});
			
			$.Visage.busy--;
		},
		
		"start": function (index, images) {
			if ($.Visage.busy > 0) {
				return;
			}
			$.Visage.busy++;
			
			if ($.Visage.images != null) {
				// We are already displaying images
				
				if ($.Visage.images == images) {
					$.Visage.showImage(index);
				}
				
				$.Visage.busy--;
				return;
			}
			$.Visage.images = images;
			
			// Hides Flash and other objects
			$("embed, object, select").css("visibility", "hidden"); // .hide() cannot be used
			
			// Reinitializes Visage DOM elements
			$("#visage-image").attr("src", $.Visage.config.files.blank).attr("alt", "").attr("title", "");
			$("#visage-count").html("");
			$("#visage-title").html("");
			$("#visage").css({"top": "20%", "bottom": "20%", "left": "20%", "right": "20%", "width": "60%", "height": "60%"});
			$("#visage-nav-prev,#visage-nav-next").hide();
			
			$.Visage.busy++;
			$("#visage-overlay").css("opacity", $.Visage.config.opacity).fadeIn($.Visage.config.speed, function () {
				if (!$.Visage.stopping) {
					$("#visage-overlay").show();
					$("#visage").show();
				}
				$.Visage.showImage(index);
				$.Visage.busy--;
			});
			
			$.Visage.busy--;
		},
		
		"stop": function () {
			if ($.Visage.stopping) {
				return;
			}
			$.Visage.stopping = true;
			
			$.Visage.busy++;
			
			if ($.Visage.loadingTimeout != null) {
				clearTimeout($.Visage.loadingTimeout);
				$.Visage.loadingTimeout = null;
			}
			
			$("#visage").stop(true, true).hide();
			if ($.Visage.image != null) {
				$.Visage.image.onload();
				$.Visage.image = null;
			}
			
			$.Visage.busy++;
			$("#visage-overlay").stop(true, true).fadeOut($.Visage.config.speed, function () {
				$("#visage-overlay").hide();
				$("#visage").hide(); // To be sure
				
				// Shows Flash and other objects
				$("embed, object, select").css("visibility", "visible"); // .show() cannot be used
				
				$.Visage.images = null;
				$.Visage.busy--;
				$.Visage.stopping = false;
			});
			
			$.Visage.busy--;
		},
		
		"showImage": function (index) {
			if (($.Visage.images == null) || $.Visage.stopping) {
				return;
			}
			
			$.Visage.busy++;
			
			var image = $.Visage.images.eq(index);
			
			if ($.Visage.images.length > 1) {
				$("#visage-count").html($.Visage.config.text.countOpening + (index + 1) + $.Visage.config.text.countOf + $.Visage.images.length + $.Visage.config.text.countClosing);
			}

			if (index > 0) {
				$("#visage-nav-prev").show();
				$("#visage-nav-prev").unbind().click(function (event) {
					event.preventDefault();
					if ($.Visage.busy == 0) {
						$.Visage.showImage(index - 1);
					}
					return false;
				});
			}
			else {
				$("#visage-nav-prev").hide();
				$("#visage-nav-prev").unbind();
			}
			
			if (index < ($.Visage.images.length - 1)) {
				$("#visage-nav-next").show();
				$("#visage-nav-next").unbind().click(function (event) {
					event.preventDefault();
					if ($.Visage.busy == 0) {
						$.Visage.showImage(index + 1);
					}
					return false;
				});
			}
			else {
				$("#visage-nav-next").hide();
				$("#visage-nav-next").unbind();
			}
			
			var src = $.Visage.imageSrc(image);
			
			if (src) {
				$("#visage-title").html(image.find("img[title]").attr("title") || image.find("img[alt]").attr("alt") || image.attr("title") || image.attr("alt") || "");
			}
			else {
				$("#visage-title").html($.Visage.config.text.error);
				src = $.Visage.config.files.error;
			}
			
			// Uses a short timeout so that display does not flicker if the image is already loaded
			$.Visage.loadingTimeout = setTimeout(function () {
				$("#visage-image").attr("src", $.Visage.config.files.blank);
			}, $.Visage.config.loadingWait);
			
			$.Visage.busy++;
			$.Visage.image = new Image();
			$.Visage.image.onload = function () {
				this.onload = function () {};
				
				if ($.Visage.loadingTimeout != null) {
					clearTimeout($.Visage.loadingTimeout);
					$.Visage.loadingTimeout = null;
				}
				
				if (($.Visage.images != null) && ($.Visage.image != null) && (!$.Visage.stopping)) {
					$("#visage-image").attr("src", src);
					$.Visage.resize();
					$.Visage.preloadNeighbors(index);
				}
				
				$.Visage.busy--;
			}
			$.Visage.image.src = src;
			
			$.Visage.busy--;
		},
		
		"preloadNeighbors": function (index) {
			if (($.Visage.images == null) || ($.Visage.image == null) || $.Visage.stopping) {
				return;
			}
			
			try {
				if (index < ($.Visage.images.length - 1)) {
					var next = new Image();
					next.onload = function () {
						next.onload = function () {};
						next = null;
					};
					var image = $.Visage.images.eq(index + 1);
					next.src = $.Visage.imageSrc(image) || $.Visage.config.files.error;
				}
			}
			catch (e) {}
			
			try {
				if (index > 0) {
					var prev = new Image();
					prev.onload = function () {
						prev.onload = function () {};
						prev = null;
					};
					var image = $.Visage.images.eq(index - 1);
					prev.src = $.Visage.imageSrc(image) || $.Visage.config.files.error;
				}
			}
			catch (e) {}
		},
		
		"imageSrc": function (image) {
			return image.attr("href") || image.attr("src") || "";
		},
		
		"resize": function () {
			if (($.Visage.images == null) || ($.Visage.image == null) || $.Visage.stopping) {
				return;
			}
			
			$.Visage.busy++;
			
			var size = $.Visage.config.maxSize; // in percents
			
			var iWidth = $.Visage.image.width + 2 * $.Visage.config.border;
			var iHeight = $.Visage.image.height + 2 * $.Visage.config.border;
			var wWidth = $(window).width()
			var wHeight = $(window).height()
			var wRatio = wWidth / wHeight;
			var iRatio = iWidth / iHeight;
			var ratio = wRatio / iRatio;
			
			// Is the image small enough to display it with original size?
			var originalSize = (iWidth <= (wWidth * 0.8)) && (iHeight <= (wHeight * 0.8));
			
			if (originalSize) {
				// Makes target size smaller
				size = size * Math.max(iWidth / (wWidth * 0.8), iHeight / (wHeight * 0.8));
			}
			
			if (ratio > 1) {
				// Variables have function scope
				var nWidth = size / ratio;
				var nHeight = size;
			}
			else {
				// Variables have function scope
				var nWidth = size;
				var nHeight = size * ratio;
			}
			
			var horizontal = (100 - nWidth) / 2;
			var vertical = (100 - nHeight) / 2;
			
			var css = {"left": horizontal + "%", "right": horizontal + "%", "top": vertical + "%", "bottom": vertical + "%"};
			if (originalSize) {
				// Border is not counted towards width and height
				css = $.extend(css, {"width": (iWidth - 2 * $.Visage.config.border) + "px", "height": (iHeight - 2 * $.Visage.config.border) + "px"});
			}
			else {
				css = $.extend(css, {"width": nWidth + "%", "height": nHeight + "%"});
			}
			
			$.Visage.busy++;
			$("#visage").stop(true, true).animate(css, $.Visage.config.speed, function () {
				if (!$.Visage.stopping) {
					// Correct any bugs there might be
					// This makes image size absolute so it does not scale so nicely when window is resized but it is (probably) bullet-proof to look nice (and correct) at the end
					if ($("#visage-image").height() != $("#visage-image-contain").height()) {
						$("#visage-image").height($("#visage-image-contain").height());
					}
					if ($("#visage-image").width() != $("#visage-image-contain").width()) {
						$("#visage-image").width($("#visage-image-contain").width());
					}
				}
				
				$.Visage.busy--;
			}).css({"overflow": "visible"}); // Has to set overflow to override default "hidden" value during jQuery animate
			
			$.Visage.busy--;
		},
		
		"keyup": function (event) {
			if (($.Visage.images == null) || ($.Visage.image == null) || $.Visage.stopping) {
				return false;
			}
			
			event = event || window.event;

			var keycode = event.keyCode;
			var key = String.fromCharCode(keycode).toLowerCase();
			
			if ((key == $.Visage.config.keys.close) || (keycode == (event.DOM_VK_ESCAPE || 27))) {
				$.Visage.stop();
				return true;
			}
			else if ((key == $.Visage.config.keys.prev) || (keycode == (event.DOM_VK_LEFT || 37))) {
				$("#visage-nav-prev").click();
				return true;
			}
			else if ((key == $.Visage.config.keys.next) || (keycode == (event.DOM_VK_RIGHT || 39))) {
				$("#visage-nav-next").click();
				return true;
			}
			else if ((key == $.Visage.config.keys.first) || (keycode == (event.DOM_VK_DOWN || 40))) {
				if ($.Visage.busy == 0) {
					$.Visage.showImage(0);
				}
				return true;
			}
			else if ((key == $.Visage.config.keys.last) || (keycode == (event.DOM_VK_UP || 38))) {
				if ($.Visage.busy == 0) {
					$.Visage.showImage($.Visage.images.length - 1);
				}
				return true;
			}
			
			return false;
		},
		
		"warn": function (message) {
			if ((typeof window.console != "undefined") && (typeof window.console.warn == "function")) {
				window.console.warn(message);
			}
		}
	});
})(jQuery);
