import d3 from 'd3';
import $ from 'jquery';

export function timelineDataHightlight(layerId, isActivate) {
  if (isActivate) {
    d3.select(
      '#timeline-footer svg g.plot rect[data-layer="' + layerId + '"]'
    ).classed('data-bar-hovered', true);
  } else {
    d3.select(
      '#timeline-footer svg g.plot rect[data-layer="' + layerId + '"]'
    ).classed('data-bar-hovered', false);
  }
}
export function getMaxTimelineWidth(ui) {
  var timeline = ui.timeline;
  var $footer = $('#timeline-footer');
  var $elWidth = $footer.width();
  var $dataWidth = timeline.x(timeline.data.end());
  if ($elWidth > $dataWidth) {
    return $dataWidth;
  }
  return $elWidth;
}