/**
* @fileOverview 全网监控模块
* @author brandonwei
* @requires jQuery
* @update 2015-10-14
*/
define(function(require, exports, module) {

    var $ = require("cdn/$");
    var Bee = require('qccomponent');
    var tmpl = require("cdn/lib/tmpl");
    var dao = require('cdn/data/dao');
    var dialog = require('cdn/dialog');
    var globalTemplate = require("../../templates/global.html.js");
    var highchart = require("cdn/highcharts");
    var map = require("cdn/lib/map");
    var china = require("cdn/lib/china");
    var pager = require('cdn/lib/pager');
    var util = require('cdn/lib/util');
    var cdnUtil = require('cdn/util');
    var dateUtil = require('cdn/lib/date');
    var tips = require('cdn/tips');
    var cdnUtil = require('cdn/util');

    var chinaMap;
    var chinaMapData;
    var delayChart;
    var delayChartData;
    var availableChart;
    var availableChartData;

    // 曲线颜色
    var lineColors = ['#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9']

    var initMap = function(){
        chinaMap = getMap($('.tc-15-data-graph-info.js-map'));
    };

    var initChart = function(){
        delayChart = getLineChart($('.tc-15-data-graph-info.js-delay-chart'));
        delayChart.hideNoData();
        delayChart.showNoData("暂无数据");
        availableChart = getLineChart($('.tc-15-data-graph-info.js-available-chart'));
        availableChart.yAxis[0].options.max = 100;
        availableChart.hideNoData();
        availableChart.showNoData("暂无数据");
    };

    var initPanel = function() {
        var _defaultDateFormat = 'YYYY-MM-DD';

        var now = new Date().getTime();
        var today = dateUtil.formatDate(now - 0, _defaultDateFormat);
        var yesterday = dateUtil.formatDate(now - 24*3600*1000, _defaultDateFormat);
        var recent7 = dateUtil.formatDate(now - 24*3600*1000*6, _defaultDateFormat);
        var recent15 = dateUtil.formatDate(now - 24*3600*1000*14, _defaultDateFormat);
        var recent30 = dateUtil.formatDate(now - 24*3600*1000*29, _defaultDateFormat);
        var picker = Bee.mount('js-date-cont', {
          $data: {
            // 是否选择日历选择器
            showCalendar: true,
            // 使用的语言包，目前支持 'zh-cn' 和 'en-us'
            lang: 'zh-cn',
            // 快捷日期选项卡
            tabs: [{ label: '今天', from: today, to: today },
                { label: '昨天', from: yesterday, to: yesterday },
                { label: '近7天', from: recent7, to: today },
                { label: '近15天', from: recent15, to: today },
                { label: '近30天', from: recent30, to: today}
                ]
            }
        });

        picker.setSelectedRange(today, today);

        //只显示最近30天的数据
        picker.setAllowRange(recent30, today);

        picker.$on('datepick', function(selected) {
            var from = selected.from;
            var to = selected.to;
            $('#js-btn-search').data('from',from);
            $('#js-btn-search').data('to',to);

            //更新页面数据
            refresh();
        });

        //初始化的时候默认时间是今天
        $('#js-btn-search').data('from',today);
        $('#js-btn-search').data('to',today);

        var strProvinces = tmpl.parse($("[data-cdn-tmpl=option_cdn_provinces]").html());
        var strIsps = tmpl.parse($("[data-cdn-tmpl=option_cdn_isps]").html());
        $('.js-dl-provinces').html(strProvinces);
        $('.js-dl-isps').html(strIsps);
        $('.js-multi-select-panel-provinces input').prop('checked', true);
        $('.js-multi-select-panel-isps input').prop('checked', true);

    };

    var getMap = function(cont,name) {
        var map = cont.highcharts('Map', {
            chart: {
                height: 600,
                width: 900,
                style: {
                    margin: "auto"
                }
            },
            title: {
                text: ''
            },
            credits: {
                enabled: false
            },
            legend: {
                title: {
                    text: ''
                },
                align: 'right',
                layout: 'vertical',
                verticalAlign: 'bottom',
                floating: false,
                borderWidth: 1,
                backgroundColor: 'white'
            },
            colors: ['#319a18', '#51af32', '#ffb800', '#e1504a', '#e32310', '#a2a2a2'],
            colorAxis: {
                dataClassColor: 'category',
                dataClasses: [{
                    to: 1000,
                    name: "好(<1s)",
                    color: "#319a18"
                }, {
                    from: 1001,
                    to: 2000,
                    name: "较好(1-2s)",
                    color: "#51af32"
                }, {
                    from: 2001,
                    to: 3000,
                    name: "告警(2-3s)",
                    color: "#ffb800"
                }, {
                    from: 3001,
                    to: 5000,
                    name: "较差(3-5s)",
                    color: "#e1504a"
                }, {
                    from: 5001,
                    name: "差(>5s)",
                    color: "#e32310"
                }]
            },
            series : [{
                data : null,
                mapData: Highcharts.maps['cn-with-city'],
                joinBy: ['name','name'],
                name: '时延',
                borderColor: '#586376',
                states: {
                    hover: {
                        color: '#e2ecf4'
                    }
                },
                tooltip: {
                    valueSuffix: '%'
                },
                dataLabels: {
                    enabled: true,
                    format: '{point.name}'
                }
            }],
            plotOptions: {
                series: {
                    events: {
                        click: function (e) {
                            $('.js-multi-select-panel-provinces input').prop('checked', false);
                            $('.js-multi-select-panel-provinces input[value="'+ e.point.pro_id + '"]').prop('checked', true);
                            $('.js-input-provinces').val(e.point.name);
                            $('.js-multi-select-panel-isps input').prop('checked', true);
                            $('.js-input-isps').val('全部运营商');
                            refresh();
                        }
                    }
                }
            },
        });

        return map.highcharts();

    };

    var getLineChart = function(cont,name) {
        var x,y;
        x = {
           dateTimeLabelFormats:{
                hour: '%H:%M',
                day: '%e日'
            },
            type: 'datetime'
        };

        y = {
            title: {
                text: ''
                
            },
            min:0,
            labels: {
                formatter: function() {
                    return this.value;
                }
            },
            allowDecimals: false
        };
        
        var chart = cont.highcharts({
            chart: {
                type: 'line',
                height: 370
            },
            credits: {
              enabled: false//去掉logo
            },
            title: {
                text: ''
            },
            subtitle: {
                text: ''
            },
            legend: {
                itemDistance: 50
            },
            xAxis: x,
            yAxis: y,
            tooltip: {
            },
            plotOptions: {
                line: {
                    pointInterval: 5 * 1000 * 60,//默认5分钟
                    marker: {
                        enabled: false,
                        symbol: 'circle',
                        radius: 0,
                        states: {
                            hover: {
                                enabled: false
                            }
                        }
                    },
                    events: {
                        legendItemClick: function () {
                            return false; 
                        }
                    }
                }       
            },
            series: [{
                name: ' ',
                data: []
            }]
        });
        
        return chart.highcharts();
    };

    //各种事件绑定
    var initEvent = function(){
        //点击地域输入框
        $('.js-input-provinces').click(function(){
            
            var self = $(this);
            var panel = $('.js-multi-select-panel-provinces');
            var ispsPanel = $('.js-multi-select-panel-isps');
            ispsPanel.hide();
            panel.toggle();
            
            return false;
        });

        //点击运营商输入框
        $('.js-input-isps').click(function(){
            
            var self = $(this);
            var panel = $('.js-multi-select-panel-isps');
            var provincesPanel = $('.js-multi-select-panel-provinces');
            provincesPanel.hide();
            panel.toggle();
            
            return false;
        });

        //地域多选面板处理
        $('.js-multi-select-panel-provinces').on('click',function(e){
            
            var self = $(this);
            var target = $(e.target);
            if((target.hasClass('js-btn-ok') || target.parent().hasClass('js-btn-ok')) && !target.hasClass('btn_unclick') && !target.parent().hasClass('btn_unclick')){
                
                var checks = self.find('input:checked');
                var res  = setInputVal(checks, 'name');
                $('.js-input-provinces').val(res);
                self.hide();
                return false;
            }else if(target.is('input')){
                var res = '';
                var checks = self.find('input');
                // 点击全部域名
                if (target.val() == 'all-provinces')
                {
                    var isChecked = target.prop('checked');
                    checks.prop('checked', isChecked);
                }
                // 点击其他单个域名
                else {
                    var proInputLength = $('.js-dl-provinces input').length;
                    var proCheckedInputLength = $('.js-dl-provinces input:checked').length;
                    var ispsInputLength = $('.js-dl-isps input').length;
                    var ispsCheckedInputLength = $('.js-dl-isps input:checked').length;
                    if (proCheckedInputLength == proInputLength) {
                        checks.prop('checked', true);
                    }
                    else {
                        // 不得超过5条线
                        if (ispsInputLength == ispsCheckedInputLength && proCheckedInputLength > 5) {
                            return false;
                        }
                        else if (ispsInputLength != ispsCheckedInputLength && ispsCheckedInputLength * proCheckedInputLength > 5)
                        {
                            return false;
                        }

                        $(checks[0]).prop('checked', false);
                    }
                }
                checks = self.find('input:checked');
                res = setInputVal(checks, 'name');
                $('.js-input-provinces').val(res);
                e.stopPropagation();
                
            }else if(target.is('label')){
                var input = target.prev();
                    input.trigger('click');
                return false;
            }else if(target.hasClass('js-btn-cancel') || target.parent().hasClass('js-btn-cancel')){
                self.hide();
                return false;
            }
            else {
                return false;
            }
            
        });

        //运营商多选面板处理
        $('.js-multi-select-panel-isps').on('click',function(e){
            
            var self = $(this);
            var target = $(e.target);
            if((target.hasClass('js-btn-ok') || target.parent().hasClass('js-btn-ok')) && !target.hasClass('btn_unclick') && !target.parent().hasClass('btn_unclick')){
                
                var checks = self.find('input:checked');
                var res  = setInputVal(checks, 'name');
                $('.js-input-isps').val(res);
                self.hide();
                return false;
            }else if(target.is('input')){
                var res = '';
                var checks = self.find('input');
                // 点击全部域名
                if (target.val() == 'all-isps')
                {
                    var isChecked = target.prop('checked');
                    checks.prop('checked', isChecked);
                }
                // 点击其他单个域名
                else {
                    var proInputLength = $('.js-dl-provinces input').length;
                    var proCheckedInputLength = $('.js-dl-provinces input:checked').length;
                    var ispsInputLength = $('.js-dl-isps input').length;
                    var ispsCheckedInputLength = $('.js-dl-isps input:checked').length;
                    if (ispsInputLength == ispsCheckedInputLength) {
                        checks.prop('checked', true);
                    }
                    else {
                        // 不得超过5条线
                        if (proInputLength == proCheckedInputLength && ispsCheckedInputLength > 5) {
                            return false;
                        }
                        else if (proInputLength != proCheckedInputLength && ispsCheckedInputLength * proCheckedInputLength > 5) {
                            return false;
                        }
                        $(checks[0]).prop('checked', false);
                    }
                }
                checks = self.find('input:checked');
                res = setInputVal(checks, 'name');
                $('.js-input-isps').val(res);
                e.stopPropagation();
                
            }else if(target.is('label')){
                var input = target.prev();
                    input.trigger('click');
                return false;
            }else if(target.hasClass('js-btn-cancel') || target.parent().hasClass('js-btn-cancel')){
                self.hide();
                return false;
            }
            else {
                return false;
            }
            
        });

        //多选对话框关闭
        $('.js-global-main-wrap').on('click',function(e){
            $('.js-multi-select-panel-provinces').hide();            
            $('.js-multi-select-panel-isps').hide();
        });

        //点击查询
        $('#js-btn-search').click(function() {
            refresh();            
            return false;
        });

        // 时延/可用性选择按钮
        $('.tc-15-rich-radio').on('click', function(e) {
            var self = $(this);
            var target = $(e.target);
            var buttons = $('.tc-15-rich-radio button');
            var mapData;
            var mapName;
            var colorAxis;

            if (!target.is('button'))
            {
                return;
            }
            var checkValue = target.val();
            if (checkValue == "delay") {
                buttons.eq(1).removeClass("checked");
                mapName = "时延";
                mapData = chinaMapData.delay_time|| [];
                colorAxis = {
                    dataClassColor: 'category',
                    dataClasses: [{
                        to: 1000,
                        name: "好(<1s)",
                        color: "#319a18"
                    }, {
                        from: 1001,
                        to: 2000,
                        name: "较好(1-2s)",
                        color: "#51af32"
                    }, {
                        from: 2001,
                        to: 3000,
                        name: "告警(2-3s)",
                        color: "#ffb800"
                    }, {
                        from: 3001,
                        to: 5000,
                        name: "较差(3-5s)",
                        color: "#e1504a"
                    }, {
                        from: 5001,
                        name: "差(>5s)",
                        color: "#e32310"
                    }]
                };               
            } else {
                buttons.eq(0).removeClass("checked");
                mapName = "可用性";
                mapData = chinaMapData.succ_rate || [];
                colorAxis = {
                    dataClassColor: 'category',
                    dataClasses: [{
                        from: 98,
                        name: "好(>98%)",
                        color: "#319a18"
                    }, {
                        from: 96,
                        to: 97.99,
                        name: "较好(98-96%)",
                        color: "#51af32"
                    }, {
                        from: 94,
                        to: 95.99,
                        name: "告警(96-94%)",
                        color: "#ffb800"
                    }, {
                        from: 92,
                        to: 93.99,
                        name: "较差(94-92%)",
                        color: "#e1504a"
                    }, {
                        to: 91.99,
                        name: "差(<92%)",
                        color: "#e32310"
                    }]
                };
            }

            target.addClass("checked");
            updateMap({
                map:chinaMap,
                name:mapName,
                data:mapData,
                colorAxis:colorAxis,
            });

        });

        //点击下载
        $('#delayDownLoad').click(function(){
            
            var self = $(this);
            var param = getParam();
            param.g_tk = cdnUtil.getACSRFToken();
            self.attr('href', CDN.FormSender.serverUrl + CDN.FormSender.commonPath + 'action=dl_global_monitor_data&type=delay_time&'+$.param(param));
            
        });
        $('#successDownLoad').click(function(){
            
            var self = $(this);
            var param = getParam();
            param.g_tk = cdnUtil.getACSRFToken();
            self.attr('href', CDN.FormSender.serverUrl + CDN.FormSender.commonPath + 'action=dl_global_monitor_data&type=succ_rate&'+$.param(param));
            
        });
    };

    var updateMap = function(opt) {
        var name = opt.name;
        var mapData;
        var map = opt.map;
        var colorAxis = opt.colorAxis;
        mapData = opt.data||[];
        
        map.series[0].update({
            name: name,
            data: mapData,
        });
        if (colorAxis)
        {
            map.colorAxis[0].update(colorAxis);
        }
        if (name == "时延")
        {
            map.options.tooltip.formatter = function(argument) {
                return '<b>'+ this.key+'</b>'+ '<br/>'+'<b>移动时延:' + (this.point.detail[4] ? this.point.detail[4].toFixed(2) +'ms' : '--') + '</b><br/>'+'<b>联通时延:' + (this.point.detail[2] ? this.point.detail[2].toFixed(2) +'ms' : '--') + '</b><br/>'+'<b>电信时延:' + (this.point.detail[1] ? this.point.detail[1].toFixed(2) +'ms' : '--') + '</b><br/>'+'<b>平均时延:' + (this.point.value ? this.point.value.toFixed(2)+'ms' : '--')+ '</b>';
            };
        }
        else {
            map.options.tooltip.formatter = function(argument) {
                return '<b>'+ this.key+'</b>' + '<br/>'+'<b>移动可用性:' + (this.point.detail[4] ? this.point.detail[4].toFixed(2)+'%' : '--') + '</b><br/>'+'<b>联通可用性:' + (this.point.detail[2] ? this.point.detail[2].toFixed(2)+'%' : '--') + '</b><br/>'+'<b>电信可用性:' + (this.point.detail[1] ? this.point.detail[1].toFixed(2)+'%' : '--') + '</b><br/>'+'<b>平均可用性:' + (this.point.value ? this.point.value.toFixed(2)+'%' : '--') + '</b>';
            };
        }
    };

    //更新图表数据
    var updateChart = function(opt) {
        var period = opt.period;
        var tickInterval = 3600*1000;
        if(period>=60){
            tickInterval = 24*3600*1000;
            delayChart.xAxis[0].options.labels.formatter = function(){
                return Highcharts.dateFormat('%Y-%m-%e %H:%M:%S', this.value);
            };
            availableChart.xAxis[0].options.labels.formatter = function(){
                return Highcharts.dateFormat('%Y-%m-%e %H:%M:%S', this.value);
            }
        }
        if (opt.data && opt.data.length > 0) {
            delayChart.xAxis[0].options.tickInterval = tickInterval;
            availableChart.xAxis[0].options.tickInterval = tickInterval;
            while (delayChart.series.length) {
                delayChart.series[0].remove();
                availableChart.series[0].remove();
            }
            for (var i = 0; i < opt.data.length; i++)
            {
                for (var j = 0; j < opt.data[i].delay_time.length; j++) {
                    if(opt.data[i].delay_time[j] !== null) {
                        opt.data[i].delay_time[j] = parseFloat(opt.data[i].delay_time[j].toFixed(2));
                        opt.data[i].succ_rate[j] = parseFloat(opt.data[i].succ_rate[j].toFixed(2));
                    }
                }
                var delayObj = {
                    name: opt.data[i].name,
                    data: opt.data[i].delay_time,
                    pointStart      : dateUtil.getUTCDateFromStr(opt.start_date),
                    pointInterval   : (period)*60*1000,
                    color:lineColors[i]
                };

                var availableObj = {
                    name: opt.data[i].name,
                    data: opt.data[i].succ_rate,
                    pointStart      : dateUtil.getUTCDateFromStr(opt.start_date),
                    pointInterval   : (period)*60*1000,
                    color:lineColors[i]
                };

                delayChart.addSeries(delayObj);
                availableChart.addSeries(availableObj);
            }
        }
        delayChart.options.tooltip.formatter = function(argument) {
            return '<b>'+ this.series.name+'</b>'+
                        '<br/>' + '<b>监测时间:'+Highcharts.dateFormat('%Y-%m-%e %H:%M:%S', this.x)+'</b>'+
                        '<br/>'+'<b>时延:'+(this.y)+'ms</b>';
        };
        availableChart.options.tooltip.formatter = function(argument) {
            return '<b>'+ this.series.name+'</b>'+
                        '<br/>' + '<b>监测时间:'+Highcharts.dateFormat('%Y-%m-%e %H:%M:%S', this.x)+'</b>'+
                        '<br/>'+'<b>可用性:'+(this.y)+'%</b>';
        };
    };

    var load = function() {
        var param = getParam();
        var name = $('.tc-15-rich-radio button.check').val();
        getGlobalrealTimeData().done(function(d){
            if(d&&d.data&&d.code==0){
                var mapData;
                var mapName;
                d.data.delay_time.forEach(function(item, index) {
                    item.detail = item.value;
                    item.value = item.detail[16777215];
                });
                d.data.succ_rate.forEach(function(item, index) {
                    item.detail = item.value;
                    item.value = item.detail[16777215];
                });
                chinaMapData = d.data;
                var colorAxis;
                if ($(".tc-15-rich-radio button.checked").val() == "delay") {
                    mapName = "时延";
                    mapData = d.data.delay_time || [];
                }
                else {
                    mapName = "可用性";
                    mapData = d.data.succ_rate || [];
                }

                updateMap({
                    name:mapName,
                    map:chinaMap,
                    data:mapData || [],
                });
            }
        });

        getGlobalStat(param).done(function(d) {
            if(d&&d.data&&d.code==0){
                updateChart({
                    data:d.data.detail,
                    period:d.data.period,
                    start_date:dateUtil.formatDate(param.start_date, "YYYY-MM-DD 00:00:00"),
                });          
            }
            else {
                tips.error(d.msg || '获取地域信息数据失败');
            }
        });
    };

    var refresh = function() {
        var param = getParam();
        var name = $('.tc-15-rich-radio button.check').val();
        getGlobalStat(param).done(function(d) {
            if(d&&d.data&&d.code==0){
                updateChart({
                    data:d.data.detail,
                    period:d.data.period,
                    start_date:dateUtil.formatDate(param.start_date, "YYYY-MM-DD 00:00:00"),
                });             
            }
            else {
                tips.error(d.msg || '获取地域信息数据失败');
            }
        });
    };

    //取参数
    var getParam = function(){
        var param = {};
        param.start_date= $('#js-btn-search').data('from');
        param.end_date=$('#js-btn-search').data('to');
        param.pro = getCurrProvinces();
        param.isp = getCurrIsps();
        param.country = 156;

        return param;
    };

    var getCurrProvinces = function() {
        var inputs = $('.js-dl-provinces').find('input:checked');
        var res = '';
        if($('#province-check-all.js-checkbox-all').is(':checked')) {
            return res
        }
        if (inputs.length == 0) {//没有选中等于全选
        }
        for (var i = 0; i < inputs.length; i++) {

            res += $(inputs[i]).val();
            if (i == inputs.length - 1) {
                break;
            }
            res += ',';
        }
        return res;
    };

    //获取当前isp列表
    var getCurrIsps = function() {
        var inputs = $('.js-dl-isps').find('input:checked');
        var res = '';
        if($('#isps-check-all.js-checkbox-all').is(':checked')) {
            return res
        }
        for (var i = 0; i < inputs.length; i++) {
            
            res += $(inputs[i]).val();
            if (i == inputs.length - 1) {
                break;
            }
            res += ',';
        }
        if (undefined == res || null == res) {
            return "";
        }
        return res;
    };

    var getGlobalStat = function(param) {
        var defer = $.Deferred();
        dao.get_global_monitor_data({
            data:param,
            success:function(d){
                defer.resolve(d);
            },
            error:function(e){
                tips.error('获取地域信息数据失败');
                defer.reject(e);
            }
        });
        return defer.promise();
    };

    var getGlobalrealTimeData = function(param) {
        var defer = $.Deferred();
        dao.get_global_realtime_data({
            data:param,
            success:function(d){
                defer.resolve(d);
            },
            error:function(e){
                tips.error('获取地域信息数据失败');
                defer.reject(e);
            }
        });
        return defer.promise();
    };

    //根据选择的元素设置input的值
    var setInputVal = function(checks, key){
        var res = '';
        if (checks.length == 0) {
            $('.js-btn-ok').addClass('btn_unclick');
        }
        else {
            $('.js-btn-ok').removeClass('btn_unclick');
        }
        if(!checks || checks.val() == 'all-provinces' || checks.val() == 'all-isps'){
            return checks.val() == 'all-provinces' ? '全部地区' : '全部运营商';
        }
        for(var i=0;i<checks.length;i++){
            res += $(checks[i]).data(key) || '';
            if(!res){
                continue;
            }
            res +=';'
        }
        return res;
    };

    return{
        container: globalTemplate,
        render: function(){
            initMap();

            initChart();

            initEvent();

            initPanel();

            load();
        }
    };
});/*  |xGv00|c27c369f250ba1194941246a604b458c */