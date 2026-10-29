import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileBarChart,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { monitoringApi } from '../../api/endpoints/monitoring';

import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';


/* ============================================================
   CONSTANTS
   ============================================================ */

const PAGE_SIZE = 10;

const HEADER_COLOR = 'var(--vettri-navy)';


/* ============================================================
   DEFAULT DATES
   ============================================================ */

// HR hint comparing attendance punches with laptop activity (ProductivitySummaryDTO.attendanceCheck).
const ATTENDANCE_CHECK = {
  OK: { label: 'Matches', color: 'var(--hz-success-600)', background: 'var(--hz-success-50)' },
  NO_PUNCH: { label: 'No punch', color: 'var(--hz-warning-600)', background: 'var(--hz-warning-50)', hint: 'Laptop was active but no attendance punch was recorded.' },
  LOW_ACTIVITY: { label: 'Low activity', color: 'var(--hz-warning-600)', background: 'var(--hz-warning-50)', hint: 'Attended, but the laptop was active for less than 40% of the attended time.' },
};

function formatClock(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function AttendanceCheck({ row }) {
  const check = ATTENDANCE_CHECK[row.attendanceCheck];
  const firstIn = formatClock(row.attendanceFirstIn);
  const lastOut = formatClock(row.attendanceLastOut);
  const worked = row.attendanceWorkedMinutes ? `${Math.floor(row.attendanceWorkedMinutes / 60)}h ${String(row.attendanceWorkedMinutes % 60).padStart(2, '0')}m` : null;
  if (!check && !firstIn) return '—';
  return (
    <div className="d-flex flex-column align-items-center gap-1" title={check?.hint}>
      {check && <span className="badge rounded-pill" style={{ backgroundColor: check.background, color: check.color, fontSize: 11, fontWeight: 600, padding: '5px 9px' }}>{check.label}</span>}
      {firstIn && <span className="text-secondary-hz" style={{ fontSize: 12 }}>{firstIn}{lastOut ? ` – ${lastOut}` : ''}{worked ? ` · ${worked}` : ''}</span>}
    </div>
  );
}

function defaultDates() {
  const end = new Date();

  const start = new Date(end);

  start.setDate(
    start.getDate() - 29
  );

  return {
    startDate:
      start
        .toISOString()
        .slice(0, 10),

    endDate:
      end
        .toISOString()
        .slice(0, 10),
  };
}


/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function MonitoringReports() {

  /* ==========================================================
     INITIAL DATES
     ========================================================== */

  const dates =
    useMemo(
      () => defaultDates(),
      []
    );


  /* ==========================================================
     STATE
     ========================================================== */

  const [
    filters,
    setFilters,
  ] = useState(dates);

  const [
    management,
    setManagement,
  ] = useState(null);

  const [
    page,
    setPage,
  ] = useState(0);

  const [
    isManagementLoading,
    setIsManagementLoading,
  ] = useState(false);

  const [
    isExporting,
    setIsExporting,
  ] = useState(false);

  const [
    exportFormat,
    setExportFormat,
  ] = useState('');

  const [
    search,
    setSearch,
  ] = useState('');


  /* ==========================================================
     PRODUCTIVITY REPORT
     ========================================================== */

  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({

    queryKey: [
      'monitoring-productivity-report',
      filters,
    ],

    queryFn: () =>
      monitoringApi.productivityReport(
        filters
      ),

  });


  /* ==========================================================
     NORMALIZE DATA
     ========================================================== */

  const reportRows =
    useMemo(() => {

      if (Array.isArray(data)) {
        return data;
      }

      if (
        Array.isArray(
          data?.content
        )
      ) {
        return data.content;
      }

      return [];

    }, [data]);


  /* ==========================================================
     SEARCH REPORT DATA
     ========================================================== */

  const filteredRows =
    useMemo(() => {

      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return reportRows;
      }

      return reportRows.filter(
        (row) => {

          const searchableText = [

            row.employeeName,

            row.employeeCode,

            row.deviceName,

            row.applicationName,

            row.date,

            row.productivityClassification,

          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return searchableText.includes(
            query
          );
        }
      );

    }, [
      reportRows,
      search,
    ]);


  /* ==========================================================
     PAGINATION
     ========================================================== */

  const totalElements =
    filteredRows.length;


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalElements /
          PAGE_SIZE
      )
    );


  const currentPage =
    Math.min(
      page,
      totalPages - 1
    );


  const pageRows =
    useMemo(() => {

      const start =
        currentPage *
        PAGE_SIZE;

      return filteredRows.slice(
        start,
        start +
          PAGE_SIZE
      );

    }, [
      filteredRows,
      currentPage,
    ]);


  const startRecord =
    totalElements === 0
      ? 0
      : currentPage *
          PAGE_SIZE +
        1;


  const endRecord =
    Math.min(
      (
        currentPage +
        1
      ) *
        PAGE_SIZE,
      totalElements
    );


  /* ==========================================================
     KEEP PAGE VALID
     ========================================================== */

  useEffect(() => {

    setPage(
      (currentPageValue) =>
        Math.min(
          currentPageValue,
          Math.max(
            totalPages - 1,
            0
          )
        )
    );

  }, [
    totalPages,
  ]);


  /* ==========================================================
     UPDATE FILTER
     ========================================================== */

  function updateFilter(
    key,
    value
  ) {

    setFilters(
      (current) => ({
        ...current,
        [key]:
          value,
      })
    );

    setPage(0);
  }


  /* ==========================================================
     UPDATE SEARCH
     ========================================================== */

  function updateSearch(
    value
  ) {

    setSearch(
      value
    );

    setPage(0);
  }


  /* ==========================================================
     CLEAR SEARCH
     ========================================================== */

  function clearSearch() {

    setSearch('');

    setPage(0);
  }


  /* ==========================================================
     PERIOD FILTER
     ========================================================== */

  function setPeriod(
    days
  ) {

    const end =
      new Date();

    const start =
      new Date(end);

    start.setDate(
      start.getDate() -
        days +
        1
    );

    setFilters(
      (current) => ({
        ...current,

        startDate:
          start
            .toISOString()
            .slice(0, 10),

        endDate:
          end
            .toISOString()
            .slice(0, 10),
      })
    );

    setPage(0);
  }


  /* ==========================================================
     MANAGEMENT REPORT
     ========================================================== */

  async function loadManagement() {

    try {

      setIsManagementLoading(
        true
      );

      const result =
        await monitoringApi.managementReport(
          filters
        );

      setManagement(
        result
      );

    } catch (error) {

      console.error(
        'Failed to load management report',
        error
      );

    } finally {

      setIsManagementLoading(
        false
      );

    }
  }


  /* ==========================================================
     DOWNLOAD REPORT
     ========================================================== */

  async function download(
    format
  ) {

    try {

      setIsExporting(
        true
      );

      setExportFormat(
        format
      );

      const blob =
        await monitoringApi.exportReport(
          format,
          filters
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          'a'
        );

      link.href =
        url;

      link.download =
        `monitoring-report.${
          format === 'excel'
            ? 'xlsx'
            : 'pdf'
        }`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(
        url
      );

    } catch (error) {

      console.error(
        'Failed to export report',
        error
      );

    } finally {

      setIsExporting(
        false
      );

      setExportFormat('');
    }
  }


  /* ==========================================================
     TABLE HEADER STYLE
     ========================================================== */

  const headerStyle = {

    height: 42,

    backgroundColor:
      HEADER_COLOR,

    color:
      '#ffffff',

    borderColor:
      'var(--hz-primary-800)',

    fontWeight:
      600,

    fontSize:
      12,

    whiteSpace:
      'nowrap',

    verticalAlign:
      'middle',

  };


  /* ==========================================================
     TABLE CELL STYLE
     ========================================================== */

  const cellStyle = {

    height: 42,

    borderColor:
      'var(--hz-border)',

    fontSize:
      12,

    verticalAlign:
      'middle',

  };


  /* ==========================================================
     RENDER
     ========================================================== */

  return (

    <div
      className="
        d-flex
        flex-column
        gap-4
      "
    >

      {/* ======================================================
          PAGE HEADER
          ====================================================== */}

      <div>

        <div
          className="
            d-flex
            align-items-center
            gap-2
          "
        >

          <div
            className="
              d-flex
              align-items-center
              justify-content-center
            "
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor:
                'var(--hz-border)',
              color:
                HEADER_COLOR,
            }}
          >

            <FileBarChart
              size={20}
            />

          </div>


          <div>

            <div
              style={{
                fontSize:
                  11,
                fontWeight:
                  600,
                textTransform:
                  'uppercase',
                letterSpacing:
                  '0.08em',
                color:
                  'var(--hz-text-secondary)',
              }}
            >
              Monitoring
            </div>


            <h1
              className="
                mb-1
              "
              style={{
                fontSize:
                  'var(--hz-text-2xl)',
                fontWeight:
                  700,
                color:
                  HEADER_COLOR,
              }}
            >
              Monitoring Reports
            </h1>

          </div>

        </div>


        <p
          className="
            text-secondary-hz
            mb-0
            mt-2
          "
          style={{
            fontSize:
              13,
          }}
        >
          Productivity and management views
          from recorded agent activity.
        </p>

      </div>


      {/* ======================================================
          FILTER CARD
          ====================================================== */}

      <Card>

        <div
          className="
            d-flex
            flex-column
            gap-3
          "
        >

          {/* ==================================================
              SEARCH
              ================================================== */}

          <div
            className="
              position-relative
            "
            style={{
              maxWidth:
                500,
              width:
                '100%',
            }}
          >

            <Search
              size={17}
              className="
                position-absolute
              "
              style={{
                left: 14,
                top: '50%',
                transform:
                  'translateY(-50%)',
                color:
                  'var(--hz-text-secondary)',
                pointerEvents:
                  'none',
                zIndex: 2,
              }}
            />


            <input
              type="search"
              className="
                form-control
                ps-5
                pe-5
              "
              style={{
                height: 42,
                borderRadius: 8,
                borderColor:
                  'var(--hz-border-strong)',
                fontSize: 13,
                boxShadow:
                  'none',
              }}
              placeholder="Search employee, device, application..."
              aria-label="Search monitoring report"
              value={
                search
              }
              onChange={
                (event) =>
                  updateSearch(
                    event.target.value
                  )
              }
            />


            {search && (

              <button
                type="button"
                className="
                  position-absolute
                  border-0
                  bg-transparent
                  d-flex
                  align-items-center
                  justify-content-center
                "
                style={{
                  right: 8,
                  top: '50%',
                  transform:
                    'translateY(-50%)',
                  width: 28,
                  height: 28,
                  color:
                    'var(--hz-text-secondary)',
                }}
                onClick={
                  clearSearch
                }
                aria-label="Clear search"
              >

                <X
                  size={15}
                />

              </button>

            )}

          </div>


          {/* ==================================================
              FILTERS
              ================================================== */}

          <div
            className="
              d-flex
              align-items-end
              gap-3
              flex-wrap
            "
          >

            {/* FROM */}

            <label
              className="
                mb-0
              "
              style={{
                fontSize:
                  12,
                fontWeight:
                  600,
                color:
                  'var(--hz-gray-600)',
              }}
            >

              From

              <input
                className="
                  form-control
                  mt-1
                "
                type="date"
                style={{
                  width:
                    160,
                  height:
                    40,
                  fontSize:
                    13,
                }}
                value={
                  filters.startDate
                }
                max={
                  filters.endDate
                }
                onChange={
                  (event) =>
                    updateFilter(
                      'startDate',
                      event.target.value
                    )
                }
              />

            </label>


            {/* TO */}

            <label
              className="
                mb-0
              "
              style={{
                fontSize:
                  12,
                fontWeight:
                  600,
                color:
                  'var(--hz-gray-600)',
              }}
            >

              To

              <input
                className="
                  form-control
                  mt-1
                "
                type="date"
                style={{
                  width:
                    160,
                  height:
                    40,
                  fontSize:
                    13,
                }}
                value={
                  filters.endDate
                }
                min={
                  filters.startDate
                }
                onChange={
                  (event) =>
                    updateFilter(
                      'endDate',
                      event.target.value
                    )
                }
              />

            </label>


            {/* EMPLOYEE CODE */}

            <label
              className="
                mb-0
              "
              style={{
                fontSize:
                  12,
                fontWeight:
                  600,
                color:
                  'var(--hz-gray-600)',
              }}
            >

              Employee code

              <input
                className="
                  form-control
                  mt-1
                "
                placeholder="EMP0001"
                style={{
                  width:
                    160,
                  height:
                    40,
                  fontSize:
                    13,
                }}
                value={
                  filters.employeeCode ||
                  ''
                }
                onChange={
                  (event) =>
                    updateFilter(
                      'employeeCode',
                      event.target.value
                    )
                }
              />

            </label>


            {/* EMPLOYEE NAME */}

            <label
              className="
                mb-0
              "
              style={{
                fontSize:
                  12,
                fontWeight:
                  600,
                color:
                  'var(--hz-gray-600)',
              }}
            >

              Employee name

              <input
                className="
                  form-control
                  mt-1
                "
                placeholder="Search employee"
                style={{
                  width:
                    190,
                  height:
                    40,
                  fontSize:
                    13,
                }}
                value={
                  filters.employeeName ||
                  ''
                }
                onChange={
                  (event) =>
                    updateFilter(
                      'employeeName',
                      event.target.value
                    )
                }
              />

            </label>


            {/* DEPARTMENT */}

            <label
              className="
                mb-0
              "
              style={{
                fontSize:
                  12,
                fontWeight:
                  600,
                color:
                  'var(--hz-gray-600)',
              }}
            >

              Department ID

              <input
                className="
                  form-control
                  mt-1
                "
                type="number"
                min="1"
                style={{
                  width:
                    130,
                  height:
                    40,
                  fontSize:
                    13,
                }}
                value={
                  filters.departmentId ||
                  ''
                }
                onChange={
                  (event) =>
                    updateFilter(
                      'departmentId',
                      event.target.value ||
                        undefined
                    )
                }
              />

            </label>


            {/* DEVICE */}

            <label
              className="
                mb-0
              "
              style={{
                fontSize:
                  12,
                fontWeight:
                  600,
                color:
                  'var(--hz-gray-600)',
              }}
            >

              Device ID

              <input
                className="
                  form-control
                  mt-1
                "
                type="number"
                min="1"
                style={{
                  width:
                    130,
                  height:
                    40,
                  fontSize:
                    13,
                }}
                value={
                  filters.deviceId ||
                  ''
                }
                onChange={
                  (event) =>
                    updateFilter(
                      'deviceId',
                      event.target.value ||
                        undefined
                    )
                }
              />

            </label>


            {/* APPLICATION */}

            <label
              className="
                mb-0
              "
              style={{
                fontSize:
                  12,
                fontWeight:
                  600,
                color:
                  'var(--hz-gray-600)',
              }}
            >

              Application

              <input
                className="
                  form-control
                  mt-1
                "
                placeholder="Filter application"
                style={{
                  width:
                    190,
                  height:
                    40,
                  fontSize:
                    13,
                }}
                value={
                  filters.applicationName ||
                  ''
                }
                onChange={
                  (event) =>
                    updateFilter(
                      'applicationName',
                      event.target.value
                    )
                }
              />

            </label>


            {/* WORK MODE */}

            <label
              className="
                mb-0
              "
              style={{
                fontSize:
                  12,
                fontWeight:
                  600,
                color:
                  'var(--hz-gray-600)',
              }}
            >

              Work mode

              <select
                className="
                  form-select
                  mt-1
                "
                style={{
                  width:
                    140,
                  height:
                    40,
                  fontSize:
                    13,
                }}
                value={
                  filters.workingMode ||
                  ''
                }
                onChange={
                  (event) =>
                    updateFilter(
                      'workingMode',
                      event.target.value ||
                        undefined
                    )
                }
              >

                <option value="">
                  All modes
                </option>

                <option value="OFFICE">
                  Office
                </option>

                <option value="WFH">
                  WFH
                </option>

              </select>

            </label>

          </div>


          {/* ==================================================
              QUICK PERIOD + ACTIONS
              ================================================== */}

          <div
            className="
              d-flex
              align-items-center
              justify-content-between
              flex-wrap
              gap-3
              pt-2
              border-top
            "
            style={{
              borderColor:
                'var(--hz-border) !important',
            }}
          >

            {/* QUICK PERIOD */}

            <div
              className="
                d-flex
                align-items-center
                gap-2
              "
            >

              <span
                style={{
                  fontSize:
                    12,
                  fontWeight:
                    600,
                  color:
                    'var(--hz-gray-600)',
                }}
              >
                Quick range:
              </span>


              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setPeriod(1)
                }
              >
                Day
              </Button>


              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setPeriod(7)
                }
              >
                Week
              </Button>


              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setPeriod(30)
                }
              >
                Month
              </Button>

            </div>


            {/* ACTIONS */}

            <div
              className="
                d-flex
                align-items-center
                gap-2
                flex-wrap
              "
            >

              <Button
                icon={
                  FileBarChart
                }
                variant="secondary"
                onClick={
                  loadManagement
                }
                loading={
                  isManagementLoading
                }
              >
                Management view
              </Button>


              <Button
                icon={
                  Download
                }
                variant="secondary"
                onClick={() =>
                  download(
                    'excel'
                  )
                }
                loading={
                  isExporting &&
                  exportFormat ===
                    'excel'
                }
                disabled={
                  isExporting
                }
              >
                Excel
              </Button>


              <Button
                icon={
                  Download
                }
                variant="secondary"
                onClick={() =>
                  download(
                    'pdf'
                  )
                }
                loading={
                  isExporting &&
                  exportFormat ===
                    'pdf'
                }
                disabled={
                  isExporting
                }
              >
                PDF
              </Button>

            </div>

          </div>

        </div>

      </Card>


      {/* ======================================================
          MANAGEMENT SUMMARY
          ====================================================== */}

      {management && (

        <Card
          title="Management summary"
          icon={
            FileBarChart
          }
        >

          <div
            className="
              row
              g-3
            "
          >

            <div
              className="
                col-6
                col-md-3
              "
            >

              <div
                className="
                  p-3
                  border
                  rounded
                  h-100
                "
                style={{
                  borderColor:
                    'var(--hz-border) !important',
                }}
              >

                <strong
                  style={{
                    fontSize:
                      20,
                    color:
                      HEADER_COLOR,
                  }}
                >
                  {
                    management.employeeDaysAnalyzed ??
                    0
                  }
                </strong>

                <div
                  className="
                    text-secondary-hz
                    mt-1
                  "
                  style={{
                    fontSize:
                      12,
                  }}
                >
                  Employee days
                </div>

              </div>

            </div>


            <div
              className="
                col-6
                col-md-3
              "
            >

              <div
                className="
                  p-3
                  border
                  rounded
                  h-100
                "
              >

                <strong
                  style={{
                    fontSize:
                      20,
                    color:
                      HEADER_COLOR,
                  }}
                >
                  {
                    management.averageWorkingHours ??
                    0
                  }
                </strong>

                <div
                  className="
                    text-secondary-hz
                    mt-1
                  "
                  style={{
                    fontSize:
                      12,
                  }}
                >
                  Average hours
                </div>

              </div>

            </div>


            <div
              className="
                col-6
                col-md-3
              "
            >

              <div
                className="
                  p-3
                  border
                  rounded
                  h-100
                "
              >

                <strong
                  style={{
                    fontSize:
                      20,
                    color:
                      HEADER_COLOR,
                  }}
                >

                  {
                    management.averageProductivityPercent ??
                    0
                  }%

                </strong>

                <div
                  className="
                    text-secondary-hz
                    mt-1
                  "
                  style={{
                    fontSize:
                      12,
                  }}
                >
                  Average productivity
                </div>

              </div>

            </div>

          </div>

        </Card>

      )}


      {/* ======================================================
          REPORT TABLE
          ====================================================== */}

      <Card
        bodyClassName="p-0"
      >

        <div
          className="
            table-responsive
            border-top
            border-bottom
          "
        >

          <table
            className="
              table
              table-bordered
              table-hover
              table-striped
              align-middle
              mb-0
            "
            style={{
              width:
                '100%',
              minWidth:
                1050,
              borderColor:
                'var(--hz-border)',
            }}
          >

            {/* ==================================================
                HEADER
                ================================================== */}

            <thead>

              <tr>

                <th
                  scope="col"
                  className="
                    ps-4
                  "
                  style={
                    headerStyle
                  }
                >
                  Employee
                </th>


                <th
                  scope="col"
                  style={
                    headerStyle
                  }
                >
                  Device
                </th>


                <th
                  scope="col"
                  className="
                    text-center
                  "
                  style={
                    headerStyle
                  }
                >
                  Date
                </th>


                <th
                  scope="col"
                  className="
                    text-center
                  "
                  style={
                    headerStyle
                  }
                >
                  Active Hours
                </th>


                <th
                  scope="col"
                  className="
                    text-center
                  "
                  style={
                    headerStyle
                  }
                >
                  Idle Hours
                </th>


                <th
                  scope="col"
                  className="
                    text-center
                  "
                  style={
                    headerStyle
                  }
                >
                  Productivity
                </th>


                <th
                  scope="col"
                  className="
                    text-center
                  "
                  style={
                    headerStyle
                  }
                  title="Same day's attendance punches compared with laptop activity. A hint for review, not a penalty."
                >
                  Attendance
                </th>


                <th
                  scope="col"
                  className="
                    text-center
                    pe-4
                  "
                  style={
                    headerStyle
                  }
                >
                  Class
                </th>

              </tr>

            </thead>


            {/* ==================================================
                BODY
                ================================================== */}

            <tbody>

              {/* =================================================
                  LOADING
                  ================================================= */}

              {isLoading && (

                <tr>

                  <td
                    colSpan={8}
                    className="
                      text-center
                      py-5
                    "
                    style={
                      cellStyle
                    }
                  >

                    <div
                      className="
                        d-flex
                        align-items-center
                        justify-content-center
                        gap-2
                        text-secondary
                      "
                    >

                      <span
                        className="
                          spinner-border
                          spinner-border-sm
                        "
                        role="status"
                        aria-hidden="true"
                      />

                      Loading monitoring report...

                    </div>

                  </td>

                </tr>

              )}


              {/* =================================================
                  ERROR
                  ================================================= */}

              {!isLoading &&
                isError && (

                  <tr>

                    <td
                      colSpan={8}
                      className="
                        text-center
                        py-5
                      "
                      style={
                        cellStyle
                      }
                    >

                      <div
                        className="
                          d-flex
                          flex-column
                          align-items-center
                          gap-2
                        "
                      >

                        <FileBarChart
                          size={30}
                          style={{
                            color:
                              'var(--hz-danger-500)',
                          }}
                        />

                        <strong>
                          Couldn't load monitoring report
                        </strong>

                        <span
                          className="
                            text-secondary
                          "
                          style={{
                            fontSize:
                              12,
                          }}
                        >
                          Please try again.
                        </span>


                        <button
                          type="button"
                          className="
                            btn
                            btn-sm
                            btn-outline-secondary
                            mt-2
                          "
                          onClick={
                            refetch
                          }
                        >
                          Retry
                        </button>

                      </div>

                    </td>

                  </tr>

                )}


              {/* =================================================
                  EMPTY
                  ================================================= */}

              {!isLoading &&
                !isError &&
                pageRows.length ===
                  0 && (

                  <tr>

                    <td
                      colSpan={8}
                      className="
                        text-center
                        py-5
                      "
                      style={
                        cellStyle
                      }
                    >

                      <div
                        className="
                          d-flex
                          flex-column
                          align-items-center
                          gap-2
                        "
                      >

                        <FileBarChart
                          size={30}
                          style={{
                            color:
                              'var(--hz-gray-400)',
                          }}
                        />

                        <strong
                          style={{
                            color:
                              'var(--hz-gray-700)',
                          }}
                        >
                          No activity in this range
                        </strong>

                        <span
                          className="
                            text-secondary
                          "
                          style={{
                            fontSize:
                              12,
                          }}
                        >
                          Recorded activity will
                          appear here once an agent
                          reports sessions.
                        </span>

                      </div>

                    </td>

                  </tr>

                )}


              {/* =================================================
                  DATA
                  ================================================= */}

              {!isLoading &&
                !isError &&
                pageRows.map(
                  (
                    row,
                    index
                  ) => (

                    <tr
                      key={
                        `${row.employeeId || 'none'}-${row.deviceId || 'none'}-${row.date || index}-${index}`
                      }
                    >

                      {/* EMPLOYEE */}

                      <td
                        className="
                          ps-4
                        "
                        style={{
                          ...cellStyle,
                          fontWeight:
                            600,
                          color:
                            HEADER_COLOR,
                        }}
                      >

                        {
                          row.employeeName ||
                          'Unassigned'
                        }

                        {row.employeeCode && (

                          <div
                            style={{
                              fontSize:
                                11,
                              fontWeight:
                                400,
                              color:
                                'var(--hz-text-secondary)',
                              marginTop:
                                2,
                            }}
                          >
                            {
                              row.employeeCode
                            }
                          </div>

                        )}

                      </td>


                      {/* DEVICE */}

                      <td
                        style={
                          cellStyle
                        }
                      >

                        {
                          row.deviceName ||
                          '—'
                        }

                      </td>


                      {/* DATE */}

                      <td
                        className="
                          text-center
                          text-nowrap
                        "
                        style={
                          cellStyle
                        }
                      >

                        {
                          row.date ||
                          '—'
                        }

                      </td>


                      {/* ACTIVE */}

                      <td
                        className="
                          text-center
                        "
                        style={{
                          ...cellStyle,
                          fontWeight:
                            600,
                        }}
                      >

                        {
                          (
                            (
                              Number(
                                row.activeSeconds
                              ) ||
                              0
                            ) /
                            3600
                          ).toFixed(
                            2
                          )
                        }

                      </td>


                      {/* IDLE */}

                      <td
                        className="
                          text-center
                        "
                        style={
                          cellStyle
                        }
                      >

                        {
                          (
                            (
                              Number(
                                row.idleSeconds
                              ) ||
                              0
                            ) /
                            3600
                          ).toFixed(
                            2
                          )
                        }

                      </td>


                      {/* PRODUCTIVITY */}

                      <td
                        className="
                          text-center
                        "
                        style={{
                          ...cellStyle,
                          fontWeight:
                            600,
                        }}
                      >

                        {
                          row.productivityPercent ??
                          0
                        }%

                      </td>


                      {/* ATTENDANCE vs ACTIVITY */}

                      <td
                        className="
                          text-center
                        "
                        style={
                          cellStyle
                        }
                      >

                        <AttendanceCheck row={row} />

                      </td>


                      {/* CLASSIFICATION */}

                      <td
                        className="
                          text-center
                          pe-4
                        "
                        style={
                          cellStyle
                        }
                      >

                        {row.productivityClassification ? (

                          <span
                            className="
                              badge
                              rounded-pill
                            "
                            style={{
                              backgroundColor:
                                'var(--hz-border)',
                              color:
                                HEADER_COLOR,
                              border:
                                '1px solid var(--hz-border-strong)',
                              fontSize:
                                11,
                              fontWeight:
                                600,
                              padding:
                                '5px 9px',
                            }}
                          >

                            {
                              row.productivityClassification
                            }

                          </span>

                        ) : (
                          '—'
                        )}

                      </td>

                    </tr>

                  )
                )}

            </tbody>

          </table>

        </div>


        {/* ====================================================
            PAGINATION
            ==================================================== */}

        {!isLoading &&
          !isError &&
          totalElements > 0 && (

            <div
              className="
                d-flex
                align-items-center
                justify-content-between
                flex-wrap
                gap-3
                px-4
                py-3
              "
              style={{
                borderTop:
                  '1px solid var(--hz-border)',
                backgroundColor:
                  'var(--hz-surface-subtle)',
                minHeight:
                  58,
              }}
            >

              {/* =================================================
                  RECORD COUNT
                  ================================================= */}

              <div
                style={{
                  color:
                    'var(--hz-text-secondary)',
                  fontSize:
                    12,
                }}
              >

                Showing{' '}

                <strong
                  style={{
                    color:
                      'var(--hz-gray-700)',
                  }}
                >
                  {
                    startRecord
                  }
                </strong>

                {' - '}

                <strong
                  style={{
                    color:
                      'var(--hz-gray-700)',
                  }}
                >
                  {
                    endRecord
                  }
                </strong>

                {' of '}

                <strong
                  style={{
                    color:
                      'var(--hz-gray-700)',
                  }}
                >
                  {
                    totalElements
                  }
                </strong>

                {' records'}

              </div>


              {/* =================================================
                  PAGINATION CONTROLS
                  ================================================= */}

              <div
                className="
                  d-flex
                  align-items-center
                  gap-1
                "
              >

                {/* PREVIOUS */}

                <button
                  type="button"
                  className="
                    btn
                    btn-sm
                    d-flex
                    align-items-center
                    justify-content-center
                  "
                  style={{
                    width:
                      34,
                    height:
                      32,

                    backgroundColor:
                      '#ffffff',

                    border:
                      '1px solid var(--hz-border-strong)',

                    color:
                      currentPage ===
                      0
                        ? 'var(--hz-border-strong)'
                        : 'var(--hz-gray-700)',

                    borderRadius:
                      6,
                  }}
                  onClick={() =>
                    setPage(
                      (
                        current
                      ) =>
                        Math.max(
                          current -
                            1,
                          0
                        )
                    )
                  }
                  disabled={
                    currentPage ===
                    0
                  }
                  aria-label="Previous page"
                >

                  <ChevronLeft
                    size={16}
                  />

                </button>


                {/* PAGE NUMBER */}

                <div
                  className="
                    d-flex
                    align-items-center
                    justify-content-center
                  "
                  style={{
                    minWidth:
                      100,
                    height:
                      32,
                    fontSize:
                      12,
                    color:
                      'var(--hz-gray-600)',
                  }}
                >

                  Page{' '}

                  <strong
                    className="mx-1"
                    style={{
                      color:
                        HEADER_COLOR,
                    }}
                  >
                    {
                      currentPage +
                      1
                    }
                  </strong>

                  of

                  <strong
                    className="ms-1"
                  >
                    {
                      totalPages
                    }
                  </strong>

                </div>


                {/* NEXT */}

                <button
                  type="button"
                  className="
                    btn
                    btn-sm
                    d-flex
                    align-items-center
                    justify-content-center
                  "
                  style={{
                    width:
                      34,
                    height:
                      32,

                    backgroundColor:
                      '#ffffff',

                    border:
                      '1px solid var(--hz-border-strong)',

                    color:
                      currentPage >=
                      totalPages -
                        1
                        ? 'var(--hz-border-strong)'
                        : 'var(--hz-gray-700)',

                    borderRadius:
                      6,
                  }}
                  onClick={() =>
                    setPage(
                      (
                        current
                      ) =>
                        Math.min(
                          current +
                            1,
                          totalPages -
                            1
                        )
                    )
                  }
                  disabled={
                    currentPage >=
                    totalPages -
                      1
                  }
                  aria-label="Next page"
                >

                  <ChevronRight
                    size={16}
                  />

                </button>

              </div>

            </div>

          )}

      </Card>

    </div>
  );
}