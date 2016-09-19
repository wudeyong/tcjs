/**
* @fileOverview 源站统计
* @author galenye
* @requires jQuery
* @refactor 2016-07-20
*/
define(function(require, exports, module) {
    var $ = require("cdn/$");
    var Bee = require('qccomponent');
    var highchart = require("cdn/highcharts");
    var dialog = require('cdn/dialog');
    var tips = require('cdn/tips');
    var cdnUtil = require('cdn/util');
    var router = require("cdn/router");
    var dao = require('cdn/data/dao');
    var helper = require("cdn/data/helper");
    var tmpl = require("cdn/lib/tmpl");
    var util = require('cdn/lib/util');
    var dateUtil = require('cdn/lib/date');
    var widgets = require("cdn/widgets/widgets");
    var htmlTemplate = require("../../templates/origin.html.js");
    require("cdn/components/overviewLinearChart");
    require("cdn/components/hostSelector");
    
    var Container = '.origin-container';
    var Component = {
        main: '',
        datePick: '',
        consumeSection: ''
    }


    /* 辅助函数 start */


    function dao_Promise(daoName, param) {
        var defer = $.Deferred();
        var param = param || {};

        param = _.each(param, function(val, key) {
            val === '' && delete param[key]
        })

        dao[daoName]({
            success : {
                "0" : function(rs) {
                    defer.resolve(rs);
                },
                "default":function(rs){
                    defer.reject(rs);
                }
            },
            data: param
        });
        return defer.promise();
    }


    // 过滤参数
    function filterParam(param) {
        $.each(param, function(k, v) {
            if(v === '') {
                delete param[k]
            }
        })

        return param
    }
    /* 辅助函数 end */

    function initDateSelector() {
        var now = new Date().getTime();
        var today = dateUtil.formatDate(now - 0, helper._defaultDateFormat);
        var yesterday = dateUtil.formatDate(now - 24*3600*1000, helper._defaultDateFormat);
        var recent7 = dateUtil.formatDate(now - 24*3600*1000*6, helper._defaultDateFormat);
        var recent15 = dateUtil.formatDate(now - 24*3600*1000*14, helper._defaultDateFormat);
        var recent30 = dateUtil.formatDate(now - 24*3600*1000*29, helper._defaultDateFormat);

        $('.datepicker_placeholder').replaceWith($('#datepicker_tmpl').html())

        Component.datePick = Bee.mount($('.js-date-cont').get(0), {
          $data: {
            // 是否选择日历选择器
            showCalendar: true,
            // 使用的语言包，目前支持 'zh-cn' 和 'en-us'
            lang: 'zh-cn',
            // 快捷日期选项卡
            tabs: [{ label: '今天', from: today, to: today},
                { label: '昨天', from: yesterday, to: yesterday },
                { label: '近7天', from: recent7, to: today },
                { label: '近15天', from: recent15, to: today },
                { label: '近30天', from: recent30, to: today}]
            },
            from: today,
            to: today
        });
        //只显示最近30天的数据
        Component.datePick.setSelectedRange(today, today);

        Component.datePick.setAllowRange(recent30, today);

        Component.datePick.$on('datepick', function(selected) {
            
            this.$set('from', selected.from);
            this.$set('to', selected.to);

            var gaptime = new Date(selected.to).getTime() - new Date(selected.from).getTime();
            gaptime = gaptime/1000/60;//单位是分钟
            
            Component.main.$set('gaptime', gaptime)

            Component.main.$set('currPeriod', $('.js-select-period option:first').val())

            Component.main.search()
        });
    }

    function initConsumeSection() {
        $('.consume_placeholder').replaceWith($('#consume_tmpl').html());

        Component.consumeSection = Bee.mount($('.consume_section').get(0), {
            $data: {
                downloadUrl: CDN.FormSender.serverUrl + CDN.FormSender.commonPath + 'action=download_hy_stat_data',
                type: 'flux',
                maxUnit_flux: '',
                maxUnit_bandwidth: '',
                maxUnit_amount: 'MB',
                maxUnit_speed: 'MBps',
                graph_flux: '',
                graph_bandwidth: '',
                graph_amount: {
                    title: '回源流量',
                    chartType: 'area',
                    points: []
                },
                graph_speed: {
                    title: '回源速度',
                    chartType: 'area',
                    points: []
                }
            },

            download: function(type) {
                var self = Component.consumeSection;

                var url = self.downloadUrl;

                var param = {
                    view: type,
                    start_date: Component.datePick.from,
                    end_date: Component.datePick.to,
                    period: Component.main.currPeriod,
                    p_id: Component.main.currProject,
                    hosts: Component.main.currHost,
                    g_tk: cdnUtil.getACSRFToken()
                };

                var temp_form = document.createElement("form");
                temp_form.action = url;
                temp_form.target = "_blank";
                temp_form.method = "post";
                temp_form.style.display = "none";
                for (var x in param) {      
                    var opt = document.createElement("textarea");      
                    opt.name = x;      
                    opt.value = param[x];      
                    temp_form.appendChild(opt);      
                }
                document.body.appendChild(temp_form);
                temp_form.submit();
            },

            displayChart: function(type) {
                var self = Component.consumeSection;

                self.$set('type', type)
                self.$set('graph_amount', self['graph_' + type])
                self.$set('maxUnit_amount', self['maxUnit_' + type])
            },

            fetchData: function(params) {
                var self = Component.consumeSection;

                self.getHyStatData(params)
            },

            getHyStatData: function(params){
                var self = Component.consumeSection;

                return dao_Promise('getHyStatData', params).then(function(rs) {


                    var data = rs.data;
                    //处理下数据格式
                    data = self.fixedHyData(data, params);
                    var maxUnit_flux = widgets.changeUnit('flux', Math.max.apply(null, data.graph_flux.points), 2, params.end_date).unit;
                    var maxUnit_bandwidth = widgets.changeUnit('bandwidth', Math.max.apply(null, data.graph_bandwidth.points), 2, params.end_date).unit;
                    var maxUnit_speed = widgets.changeUnit('flux', Math.max.apply(null, data.graph_speed.points), 2, params.end_date).unit + 'ps';

                    self.$set('graph_flux', data.graph_flux)
                    self.$set('graph_bandwidth', data.graph_bandwidth)
                    self.$set('graph_speed', data.graph_speed)
                    self.$set('maxUnit_flux', maxUnit_flux)
                    self.$set('maxUnit_bandwidth', maxUnit_bandwidth)
                    self.$set('maxUnit_speed', maxUnit_speed)

                    if(self.type === 'flux') {
                        self.$set('graph_amount', data.graph_flux)
                        self.$set('maxUnit_amount', maxUnit_flux)
                    }else {
                        self.$set('graph_amount', data.graph_bandwidth)
                        self.$set('maxUnit_amount', maxUnit_bandwidth)
                    }

                }).fail(function(e) {
                    tips.error(e.msg || helper._defaultErrMsg)
                })

            },

            fixedHyData: function(data, params) {
                var res = {}

                res.graph_flux = {
                    title: '回源流量',
                    start_date: params.start_date,
                    end_date: params.end_date,
                    period: data.period,
                    pay_type: 'flux',
                    unit: 'Byte',
                    points: data.time_data.hy_flux
                }
                res.graph_bandwidth = {
                    title: '回源带宽',
                    start_date: params.start_date,
                    end_date: params.end_date,
                    period: data.period,
                    pay_type: 'bandwidth',
                    unit: 'b',
                    points: data.time_data.hy_bandwidth
                }
                res.graph_speed = {
                    title: '回源速度',
                    start_date: params.start_date,
                    end_date: params.end_date,
                    period: data.period,
                    pay_type: 'flux',
                    extend_type: 'speed',
                    unit: 'Byte',
                    points: data.time_data.hy_speed
                }

                return res
            },

            fixedType: function(type) {
                return helper.pay_type[type]
            },

            $afterInit: function() {

            }
        })

    }

    function initChildren() {
        initDateSelector();

        initConsumeSection();
    }

    function initMain() {

        Component.main = Bee.mount($(Container).get(0), {
            $data: {
                host: {
                    list: []
                },
                projectList: [],
                gaptime: 0,
                currPeriod: 5,
                currProject: '',
                currHost: '',
                currSection: 'consume',
            },

            search: function() {
                this.$set('currHost', this.$refs['hostSelector'].output)

                var params = {
                    start_date: Component.datePick.from,
                    end_date: Component.datePick.to,
                    period: this.currPeriod,
                    p_id: this.currProject,
                    hosts: this.currHost
                };

                Component.consumeSection.fetchData(params);
            },

            getQueryDimension: function(){

                var defer = $.Deferred();

                dao.getQueryDimension({
                    data    : {},
                    success : function(d){
                        defer.resolve(d);
                    },
                    error   : function(d){
                        d = d || {};
                        tips.error(d.msg || helper._defaultErrMsg);
                        defer.reject(d);
                    }
                });

                return defer.promise();
            },

            $afterInit: function() {
                var self = this;

                this.getQueryDimension().then(function(rs) {
                    self.$set('host.list', rs.data.hosts)

                    rs.data.projects.unshift({
                        id: '',
                        name: '全部项目'
                    })

                    self.$set('projectList', rs.data.projects)

                    self.search()
                })
            }
        });
    }

    return{
        container: htmlTemplate,
        render: function(){

            initChildren()

            initMain();

        }
    }
});
/*  |xGv00|87871eac2ca308c627124bfca9090928 */