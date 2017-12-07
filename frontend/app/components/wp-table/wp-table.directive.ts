// -- copyright
// OpenProject is a project management system.
// Copyright (C) 2012-2015 the OpenProject Foundation (OPF)
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See doc/COPYRIGHT.rdoc for more details.
// ++

import {AfterViewInit, Component, ElementRef, Inject, Injectable} from '@angular/core';
import {downgradeComponent, downgradeInjectable} from '@angular/upgrade/static';
import {columnsModalToken, I18nToken} from 'core-app/angular4-transition-utils';
import {Observable} from 'rxjs/Observable';
import openprojectModule from '../../angular-modules';
import {scopedObservable} from '../../helpers/angular-rx-utils';
import {debugLog} from '../../helpers/debug_output';
import {ContextMenuService} from '../context-menus/context-menu.service';
import {States} from '../states.service';
import {WorkPackageTableColumnsService} from '../wp-fast-table/state/wp-table-columns.service';
import {WorkPackageTableGroupByService} from '../wp-fast-table/state/wp-table-group-by.service';
import {WorkPackageTableTimelineService} from '../wp-fast-table/state/wp-table-timeline.service';
import {WorkPackageTable} from '../wp-fast-table/wp-fast-table';
import {WorkPackageTimelineTableController} from './timeline/container/wp-timeline-container.directive';
import {WpTableHoverSync} from './wp-table-hover-sync';
import {createScrollSync} from './wp-table-scroll-sync';


/**
 * TODO remove once the transition to Angular4 is completed
 */
@Injectable()
export class WorkPackagesTableControllerHolder {
  instance:WorkPackagesTableController;
}

openprojectModule.factory(
  'workPackagesTableControllerHolder',
  downgradeInjectable(WorkPackagesTableControllerHolder));


@Component({
  template: require('!!raw-loader!./wp-table.directive.html')
})
export class WorkPackagesTableController implements AfterViewInit {

  private $element:JQuery;

  private scrollSyncUpdate:(timelineVisible:boolean) => any;

  public table:HTMLElement;

  public timeline:HTMLElement;

  constructor(private elementRef:ElementRef,
              @Inject(columnsModalToken) private columnsModal:any,
              private contextMenu:ContextMenuService,
              private workPackagesTableControllerHolder:WorkPackagesTableControllerHolder,
              private states:States,
              @Inject(I18nToken) private I18n:op.I18n,
              private wpTableGroupBy:WorkPackageTableGroupByService,
              private wpTableTimeline:WorkPackageTableTimelineService,
              private wpTableColumns:WorkPackageTableColumnsService) {

    workPackagesTableControllerHolder.instance = this;
  }

  ngAfterViewInit():void {
    this.$element = jQuery(this.elementRef.nativeElement);
    this.scrollSyncUpdate = createScrollSync(this.$element);

    // Clear any old table subscribers
    this.states.table.stopAllSubscriptions.next();

    $scope.locale = I18n.locale;

    $scope.text = {
      cancel: I18n.t('js.button_cancel'),
      noResults: {
        title: I18n.t('js.work_packages.no_results.title'),
        description: I18n.t('js.work_packages.no_results.description')
      },
      faultyQuery: {
        title: I18n.t('js.work_packages.faulty_query.title'),
        description: I18n.t('js.work_packages.faulty_query.description')
      },
      addColumns: I18n.t('js.label_add_columns'),
      tableSummary: I18n.t('js.work_packages.table.summary'),
      tableSummaryHints: [
        I18n.t('js.work_packages.table.text_inline_edit'),
        I18n.t('js.work_packages.table.text_select_hint'),
        I18n.t('js.work_packages.table.text_sort_hint')
      ].join(' ')
    };

    $scope.cancelInlineWorkPackage = function(index:number, row:any) {
      $rootScope.$emit('inlineWorkPackageCreateCancelled', index, row);
    };

    Observable.combineLatest(
      scopedObservable($scope, states.query.resource.values$()),
      scopedObservable($scope, states.table.results.values$()),
      wpTableGroupBy.observeOnScope($scope),
      wpTableColumns.observeOnScope($scope),
      wpTableTimeline.observeOnScope($scope)
    ).subscribe(([query, results, groupBy, columns, timelines]) => {

      $scope.query = query;
      $scope.rowcount = results.count;

      $scope.groupBy = groupBy.current;
      $scope.columns = columns.current;
      // Total columns = all available columns + id + checkbox
      $scope.numTableColumns = $scope.columns.length + 2;

      if ($scope.timelineVisible !== timelines.current) {
        this.scrollSyncUpdate(timelines.current);
      }
      $scope.timelineVisible = timelines.current;
    });

    // Locate table and timeline elements
    const tableAndTimeline = this.getTableAndTimelineElement();
    this.table = tableAndTimeline[0];
    this.timeline = tableAndTimeline[1];

    // sync hover from table to timeline
    const wpTableHoverSync = new WpTableHoverSync(this.$element);
    wpTableHoverSync.activate();
    this.$scope.$on('$destroy', () => {
      wpTableHoverSync.deactivate();
    });
  }

  public registerTimeline(controller:WorkPackageTimelineTableController, body:HTMLElement) {
    var t0 = performance.now();

    const tbody = this.$element.find('.work-package--results-tbody');
    this.$scope.table = new WorkPackageTable(this.$element[0], tbody[0], body, controller);
    this.$scope.tbody = tbody;
    controller.workPackageTable = this.$scope.table;


    var t1 = performance.now();
    debugLog('Render took ' + (t1 - t0) + ' milliseconds.');
  }

  public openColumnsModal() {
    this.contextMenu.close();
    this.columnsModal.activate();
  }

  private getTableAndTimelineElement():[HTMLElement, HTMLElement] {
    const $tableSide = this.$element.find('.work-packages-tabletimeline--table-side');
    const $timelineSide = this.$element.find('.work-packages-tabletimeline--timeline-side');

    if ($timelineSide.length === 0 || $tableSide.length === 0) {
      throw new Error('invalid state');
    }

    return [$tableSide[0], $timelineSide[0]];
  }
}

// angular
//   .module('openproject.workPackages.directives')
//   .directive('wpTable', wpTable);

// function wpTable():any {
//   return {
//     scope: {
//       projectIdentifier: '='
//     },
//   };
// }

angular
  .module('openproject.workPackages.directives')
  .directive('wpTable',
    downgradeComponent({component: WorkPackagesTableController}));
