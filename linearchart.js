/**
 * @author galenye
 * @created 2016/7/6
 * @description 注册一个Bee组件，用于图表初始化
 * 图表所需的参数有
 * chartType 图表类型 area/line
 * title 图表标题
 * points x轴数据
 * period 时间刻度的间隔
 * unit y轴单位
 * data_name 数据的legend名
 * start_date 开始时间 格式为 YYYY-MM-DD
 * pay_type 付费方式
 * showUnit Y轴是否显示单位 Boolean 可选 默认false
 * formatterTimeUnit hover时显示的时间格式 默认是 MM-DD hh:mm
 * extend_type 特殊的一些形式(speed)
 */
define(function(require, exports, module) {
    var Bee = require('qccomponent');
    var _ = require('cdn/lib/underscore');
    var widgets = require('cdn/widgets/widgets');
    var util = require('cdn/lib/util');
    require('cdn/highcharts');

    var dateUtil = require('cdn/lib/date');

    function getMaxUnit(pay_type, points, date) {
        var max = widgets.changeUnit(pay_type, Math.max.apply(null, points), 2, date);
        var maxUnit = max.unit;

        return maxUnit;
    }

	function properUnit(points, pay_type, maxUnit, start_date, end_date) {
        points = _.clone(points);

        var daysObj = util.unitConvertDays(start_date, end_date);
        var daysTotal = daysObj.total;
        var use1024 = daysObj.use1024;
        var use1024Length = use1024 / daysTotal * points.length;
        var points_1024 = points.slice(0, use1024Length);
        var points_1000 = points.slice(use1024Length, points.length);
        _.each(points_1024, function(val, idx) {
            points_1024[idx] = widgets.byteToRightNum(maxUnit, val, start_date)
        });
        _.each(points_1000, function(val, idx) {
            points_1000[idx] = widgets.byteToRightNum(maxUnit, val, end_date)
        });
        _.each(points_1024.concat(points_1000), function(val, idx) {
            points[idx] = val;
        });
        
		return points
    }

    var overviewLinearChart = Bee.extend({
        $tpl: '<div class="chart-area"></div>',

        $data: {
            categories: [],
            points: [],
            desc: '数据'
        },

        $afterInit: function() {
            var bee, none, unit, pay_type, points, maxUnit, showUnit, defaultConfig, chart, extend_type, speed_unit, formatterTimeUnit;

            this.$watch('points', function(v) {

                bee = this;
                none = { style: {display: 'none' } };
                unit = bee.unit;
                pay_type = bee.pay_type;
                points = bee.points;
                showUnit = bee.showUnit;
                extend_type = bee.extend_type;
                formatterTimeUnit = bee.formatterTimeUnit || "MM-DD hh:mm";

                if(pay_type) {
                    maxUnit = getMaxUnit(pay_type, points, bee.end_date);
                    points = properUnit(points, pay_type, maxUnit, bee.start_date, bee.end_date)

                    if(extend_type === 'speed') {
                        speed_unit = maxUnit + 'ps';
                    }
                }

                $(bee.$el).empty()

                defaultConfig = {
                    chart: {
                        type: bee.chartType || 'line'
                    },
                    title: none,
                    subtitle: none,
                    lang: {
                        noData: '暂无数据'
                    },
                    plotOptions: {
                        series: {
                            pointInterval: bee.period * 60 * 1000,
                            pointStart: dateUtil.getUTCDateFromStr(bee.start_date + ' 00:00:00')
                        }
                    },
                    xAxis: {
                        tickmarkPlacement: 'on',
                        dateTimeLabelFormats: {
                            hour: '%H:%M',
                            day: '%e日'
                        },
                        type: 'datetime'
                    },
                    yAxis: {
                        min: 0,
                        title: {
                            text: null
                        },
                        labels: {
                            format: '{value}'+ (showUnit ? (speed_unit || maxUnit || bee.unit) : '')
                        }
                    },
                    tooltip: {
                        useHTML: true,
                        style: {
                            padding: 1,
                            backgroundColor: '#EEE'
                        },
                        formatter: function() {
                            var y = this.y;
                            var _time = dateUtil.formatDate(dateUtil.convertUTCMsToLocalDate(this.x), 'YYYY-MM-DD');
                            var time = dateUtil.formatDate(dateUtil.convertUTCMsToLocalDate(this.x), formatterTimeUnit);
                            if (!points.length) {
                                unit = '';
                                y = '(没有数据)';
                            } else {

                                if (pay_type) {
                                    y = widgets.changeUnit(pay_type, widgets.toRightByte(maxUnit, y, _time), 2, _time).str;
                                    
                                    if(speed_unit) {
                                        y += 'ps';
                                    }

                                    unit = '';
                                }else {
                                    y = y
                                }
                            }

                            var html = '<h3 style="padding: 4px 5px;">' + time + ' <em>' + y + unit + '</em></h3>';

                            return html;
                        },
                        headerFormat: '<span style="font-size: 14px">{point.x} {point.y}</span><br />'
                    },
                    legend: none,
                    series: [{
                        name: bee.data_name || bee.title,
                        data: points
                    }],
                    credits: {
                        enabled: false
                    }
                }

                chart = $(bee.$el).highcharts(defaultConfig);

            }, true)

        }
    });

    Bee.tag('overview-linear-chart', overviewLinearChart);

    module.exports = overviewLinearChart;
});/*  |xGv00|cc1d2c87f53eb8aa2106a26cd21b7678 */