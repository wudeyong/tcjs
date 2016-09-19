/* menu */
define("cdn/lib/menu",function(require, exports, module) {
	'use strict';

	var router = require("cdn/router");
	var nmc = require("cdn/nmc");
	var $ = require("cdn/$");

	var Menu = {
		cn: '',
		oversea: '',
		current: ''
	}
	var Menu_type = {
		'oversea': '海外',
		'cn': '国内'
	}
	var sidebar = $('#sidebar');
	var container = $('#container');

	/**
	 * 先调用getMenu
	 * 缓存菜单
	 * 		首次访问：
	 * 		-判断是否有海外菜单权限
	 *   	-判断访问的是国内还是海外，渲染相应的菜单
	 *
	 * 		再次访问：
	 * 		-如果菜单类型和当前类型相同，则不渲染
	 */

	function getMenu(path, cb) {
		var type = path.indexOf('_oversea') > -1 ? 'oversea' : 'cn';

		nmc.getMenu("cdn", function(data) {


			/**
			 * mock
			 */


			data.menu = data.menu_local;


			// 再次访问，若相同，则返回
			if(type === Menu.current) {
				cb(data)
				return
			}

			// 缓存菜单
			if(!Menu.cn) {
				Menu.cn = data.menu;
			}
			if(!Menu.oversea && data.menu_oversea) {
				Menu.oversea = data.menu_oversea;
			}



			if(data.menu_oversea) {
				
				renderMenu(type)
				renderSwitchBtn(type)

			}else {

				if(type === 'oversea') {
					router.navigate("/cdn");
					return
				}else {
					renderMenu(type)
				}

			}

			Menu.current = type;

			cb(data)
		})
	}

	function getMenuHtml(type) {
		var html = '';

		var title = Menu_type[type];

		html += '<div class="menu">'
				+ '<h2>CDN<span class="tc-badge" style="background: #7AB1DE;margin-left:5px; padding: 2px 4px; margin-bottom: 6px;">' + title + '</span></h2><hr class="line-mod">\n'
				+ '<dl class="menu-list def-scroll keyboard-focus-obj">\n';

		$.each(Menu[type], function(idx, item) {
			if(item.menu) {
				html += '<dd tabindex="0" data-nav-dropdown="1">\n'
					+ '<a class="menu-lv2" data-event="sidebar_accordion" href="javascript:void(0)"><span>' + item.title + '</span><i class="white-down-icon">开</i></a>\n'
					+ '<ul class="menu-sub">\n';

				$.each(item.menu, function(i, sub) {
					html += '<li><a class="menu-lv3" data-event="nav" href="' + sub.href + '"><i class="ico-dot"></i><span>' + sub.name + '</span></a></li>\n';
				});

				html += '</ul>\n'
					+ '</dd>\n'
			}else {
				html += '<dd><a class="menu-lv2" data-event="nav" href="' + item.href + '"><span>' + item.name + '</span></a></dd>\n';
			}
		})
						
		html += '</dl>\n'
				+ '</div>';
		html += '<a class="btn-fold-menu" href="javascript:void(0);" title="收起" data-event="toggle_sidebar">收起</a>';

		return html
	}

	function renderMenu(type) {

		var html = getMenuHtml(type);
		// sidebar.html(html).hide().fadeIn()
		sidebar.hide().html(html).show()
	}

	function renderSwitchBtn(type) {
		var menuList = $('.menu-list');
		var text = type === 'oversea' ? '切换至国内' : '切换至海外';
		var href = type === 'oversea' ? '/cdn' : '/cdn/access_oversea';

		var html = '<dd>\n'
					+ '<hr class="line-mod">\n'
					+ '<a class="menu-lv2" data-event="nav" href="' + href + '">\n'
						+ '<span><i class="convert-ip-icon"></i><em class="switch-cdn">' + text + '</em></span>\n'
                	+ '<em class="badge"></em>\n'
                	+ '</a>\n'
                	+ '</dd>'

        menuList.append(html);
	}

	// $('[data-event=sidebar_accordion]').on('click', function() {
	// 	$(this).closest('dd').toggleClass('.act')
	// })


	return getMenu;
})/*  |xGv00|d4d8ac97a79fbe631c03fdc0eb33ad5e */