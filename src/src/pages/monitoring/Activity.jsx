import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Activity as ActivityIcon,
  X,
} from 'lucide-react';

import {
  monitoringApi,
  getSessionId,
  getSessionEmployeeName,
  getSessionDeviceName,
  getSessionApp,
  getSessionWindowTitle,
  getSessionStart,
  getSessionEnd,
  getSessionDurationSeconds,
} from '../../api/endpoints/monitoring';

import { employeesApi } from '../../api/endpoints/employees';

import {
  formatDateTimeIST,
  formatDurationShort,
  toISTDateInputValue,
  istDateInputToUtcRange,
} from '../../utils/formatDateTime';

import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import FilterBar from '../../components/ui/FilterBar';


/* ============================================================
   CONSTANTS
   ============================================================ */

const PAGE_SIZE =10;

const HEADER_COLOR = '#0B2342';


/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function Activity() {

  /* ==========================================================
     DEFAULT DATE
     ========================================================== */

  const today =
    toISTDateInputValue();


  /* ==========================================================
     STATE
     ========================================================== */

  const [
    dateFrom,
    setDateFrom,
  ] = useState(today);

  const [
    dateTo,
    setDateTo,
  ] = useState(today);

  const [
    employeeId,
    setEmployeeId,
  ] = useState('');

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    page,
    setPage,
  ] = useState(0);


  /* ==========================================================
     EMPLOYEES
     ========================================================== */

  const {
    data: employees,
  } = useQuery({
    queryKey: [
      'employees',
    ],

    queryFn: () =>
      employeesApi.list(),
  });


  /* ==========================================================
     DATE RANGE
     ========================================================== */

  const {
    from,
  } =
    istDateInputToUtcRange(
      dateFrom
    );

  const {
    to,
  } =
    istDateInputToUtcRange(
      dateTo
    );


  /* ==========================================================
     SESSION DATA
     ========================================================== */

  const {
    data: sessionsPage,
    isLoading,
    isError,
    refetch,
  } = useQuery({

    queryKey: [
      'monitoring-sessions-search',
      from,
      to,
      employeeId,
      search,
      page,
    ],

    queryFn: () =>
      monitoringApi.searchSessions({

        from,

        to,

        employeeId:
          employeeId ||
          undefined,

        windowTitle:
          search.trim() ||
          undefined,

        page,

        size:
          PAGE_SIZE,

      }),

    refetchInterval:
      30_000,
  });


  /* ==========================================================
     SEARCH FILTER
     ========================================================== */

  const filtered =
    useMemo(() => {

      const q =
        search
          .trim()
          .toLowerCase();


      return (
        sessionsPage?.content ||
        []
      )

        .filter(
          (session) => {

            if (!q) {
              return true;
            }


            const searchableText = [

              getSessionEmployeeName(
                session
              ),

              getSessionDeviceName(
                session
              ),

              getSessionApp(
                session
              ),

              getSessionWindowTitle(
                session
              ),

            ]

              .filter(Boolean)

              .join(' ')

              .toLowerCase();


            return searchableText.includes(
              q
            );
          }
        )

        .sort(
          (
            a,
            b
          ) =>
            new Date(
              getSessionStart(
                b
              )
            ) -
            new Date(
              getSessionStart(
                a
              )
            )
        );

    }, [
      sessionsPage,
      search,
    ]);


  /* ==========================================================
     PAGINATION
     ========================================================== */

  const totalElements =
    sessionsPage?.totalElements ||
    0;


  const totalPages =
    Math.max(
      sessionsPage?.totalPages ||
        0,
      1
    );


  const currentPage =
    Math.min(
      page,
      totalPages - 1
    );


  const pageRows =
    filtered;


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
     FILTER UPDATE
     ========================================================== */

  function updateFilter(
    setter
  ) {

    return (
      value
    ) => {

      setter(
        value
      );

      setPage(
        0
      );
    };
  }


  /* ==========================================================
     CLEAR SEARCH
     ========================================================== */

  function clearSearch() {

    setSearch('');

    setPage(0);
  }


  /* ==========================================================
     TABLE COLUMNS
     ========================================================== */

  const columns = [

    {
      key: 'employee',

      label: 'Employee',

      render: (
        session
      ) =>
        getSessionEmployeeName(
          session
        ),
    },


    {
      key: 'device',

      label: 'Device',

      render: (
        session
      ) =>
        getSessionDeviceName(
          session
        ),
    },


    {
      key: 'application',

      label: 'Application',

      render: (
        session
      ) =>
        getSessionApp(
          session
        ),
    },


    {
      key: 'windowTitle',

      label: 'Window Title',

      render: (
        session
      ) =>
        getSessionWindowTitle(
          session
        ),
    },


    {
      key: 'start',

      label: 'Start Time',

      render: (
        session
      ) =>
        formatDateTimeIST(
          getSessionStart(
            session
          )
        ),
    },


    {
      key: 'end',

      label: 'End Time',

      render: (
        session
      ) =>
        formatDateTimeIST(
          getSessionEnd(
            session
          )
        ),
    },


    {
      key: 'duration',

      label: 'Duration',

      render: (
        session
      ) =>
        formatDurationShort(
          getSessionDurationSeconds(
            session
          )
        ),
    },

  ];


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
      '#18385c',

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
      '#d9e1e8',

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

      <PageHeader
        eyebrow="Monitoring"
        title="Activity"
        description="Application and window activity sessions reported by the monitoring agents"
      />


      {/* ======================================================
          FILTER BAR
          ====================================================== */}

      <FilterBar>

        {/* ====================================================
            SEARCH BOX
            ==================================================== */}

        <div
          className="
            position-relative
          "
          style={{
            width:
              '100%',
            maxWidth:
              380,
          }}
        >

          {/* SEARCH ICON */}

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
                '#64748B',
              pointerEvents:
                'none',
              zIndex: 2,
            }}
          />


          {/* SEARCH INPUT */}

          <input
            type="search"
            className="
              form-control
              ps-5
              pe-5
            "
            style={{
              height: 40,
              borderRadius:
                8,
              fontSize:
                13,
              borderColor:
                '#CBD5E1',
              boxShadow:
                'none',
            }}
            placeholder="
              Search employee, device, application or window...
            "
            aria-label="
              Search monitoring activity
            "
            value={
              search
            }
            onChange={
              (event) =>
                updateFilter(
                  setSearch
                )(
                  event.target.value
                )
            }
          />


          {/* CLEAR BUTTON */}

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
                  '#64748B',
              }}
              onClick={
                clearSearch
              }
              aria-label="
                Clear search
              "
            >

              <X
                size={15}
              />

            </button>

          )}

        </div>


        {/* ====================================================
            EMPLOYEE FILTER
            ==================================================== */}

        <select
          className="
            form-select
          "
          style={{
            maxWidth:
              220,
            height: 40,
            fontSize:
              13,
            borderRadius:
              8,
            borderColor:
              '#CBD5E1',
          }}
          value={
            employeeId
          }
          onChange={
            (event) =>
              updateFilter(
                setEmployeeId
              )(
                event.target.value
              )
          }
        >

          <option value="">
            All Employees
          </option>

          {(
            employees ||
            []
          ).map(
            (
              employee
            ) => (

              <option
                key={
                  employee.id
                }
                value={
                  employee.id
                }
              >

                {
                  employee.fullName
                }

              </option>

            )
          )}

        </select>


        {/* ====================================================
            DATE RANGE
            ==================================================== */}

        <div
          className="
            d-flex
            align-items-center
            gap-2
          "
        >

          <input
            type="date"
            className="
              form-control
            "
            style={{
              maxWidth:
                160,
              height: 40,
              fontSize:
                13,
              borderRadius:
                8,
              borderColor:
                '#CBD5E1',
            }}
            value={
              dateFrom
            }
            max={
              dateTo
            }
            onChange={
              (event) =>
                updateFilter(
                  setDateFrom
                )(
                  event.target.value
                )
            }
          />


          <span
            style={{
              color:
                '#64748B',
              fontSize:
                12,
              fontWeight:
                500,
            }}
          >
            to
          </span>


          <input
            type="date"
            className="
              form-control
            "
            style={{
              maxWidth:
                160,
              height: 40,
              fontSize:
                13,
              borderRadius:
                8,
              borderColor:
                '#CBD5E1',
            }}
            value={
              dateTo
            }
            min={
              dateFrom
            }
            onChange={
              (event) =>
                updateFilter(
                  setDateTo
                )(
                  event.target.value
                )
            }
          />

        </div>

      </FilterBar>


      {/* ======================================================
          ACTIVITY TABLE
          ====================================================== */}

      <Card
        bodyClassName="p-0"
      >

        {/* ====================================================
            TABLE
            ==================================================== */}

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
                '#d9e1e8',
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
                  style={
                    headerStyle
                  }
                >
                  Application
                </th>


                <th
                  scope="col"
                  style={
                    headerStyle
                  }
                >
                  Window Title
                </th>


                <th
                  scope="col"
                  className="
                    text-nowrap
                  "
                  style={
                    headerStyle
                  }
                >
                  Start Time
                </th>


                <th
                  scope="col"
                  className="
                    text-nowrap
                  "
                  style={
                    headerStyle
                  }
                >
                  End Time
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
                  Duration
                </th>

              </tr>

            </thead>


            {/* ==================================================
                BODY
                ================================================== */}

            <tbody>

              {/* ================================================
                  LOADING
                  ================================================ */}

              {isLoading && (

                <tr>

                  <td
                    colSpan={7}
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

                      Loading activity...

                    </div>

                  </td>

                </tr>

              )}


              {/* ================================================
                  ERROR
                  ================================================ */}

              {!isLoading &&
                isError && (

                  <tr>

                    <td
                      colSpan={7}
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

                        <ActivityIcon
                          size={28}
                          style={{
                            color:
                              '#DC3545',
                          }}
                        />

                        <strong>
                          Couldn't load activity
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


              {/* ================================================
                  EMPTY
                  ================================================ */}

              {!isLoading &&
                !isError &&
                pageRows.length ===
                  0 && (

                  <tr>

                    <td
                      colSpan={7}
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

                        <ActivityIcon
                          size={30}
                          style={{
                            color:
                              '#94A3B8',
                          }}
                        />

                        <strong
                          style={{
                            color:
                              '#334155',
                          }}
                        >

                          {
                            search ||
                            employeeId
                              ? 'No matching activity'
                              : 'No activity in this range'
                          }

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

                          Try widening the date
                          range, or clearing the
                          search and employee filters.

                        </span>

                      </div>

                    </td>

                  </tr>

                )}


              {/* ================================================
                  DATA ROWS
                  ================================================ */}

              {!isLoading &&
                !isError &&
                pageRows.map(
                  (
                    session,
                    index
                  ) => (

                    <tr
                      key={
                        getSessionId(
                          session
                        )
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
                            '#0B2342',
                        }}
                      >

                        {
                          getSessionEmployeeName(
                            session
                          ) ||
                          '—'
                        }

                      </td>


                      {/* DEVICE */}

                      <td
                        style={
                          cellStyle
                        }
                      >

                        {
                          getSessionDeviceName(
                            session
                          ) ||
                          '—'
                        }

                      </td>


                      {/* APPLICATION */}

                      <td
                        style={{
                          ...cellStyle,
                          fontWeight:
                            500,
                        }}
                      >

                        {
                          getSessionApp(
                            session
                          ) ||
                          '—'
                        }

                      </td>


                      {/* WINDOW TITLE */}

                      <td
                        style={{
                          ...cellStyle,
                          maxWidth:
                            350,
                        }}
                      >

                        <span
                          className="
                            d-block
                            text-truncate
                          "
                          style={{
                            maxWidth:
                              330,
                          }}
                          title={
                            getSessionWindowTitle(
                              session
                            ) ||
                            ''
                          }
                        >

                          {
                            getSessionWindowTitle(
                              session
                            ) ||
                            '—'
                          }

                        </span>

                      </td>


                      {/* START */}

                      <td
                        className="
                          text-nowrap
                        "
                        style={
                          cellStyle
                        }
                      >

                        {
                          formatDateTimeIST(
                            getSessionStart(
                              session
                            )
                          )
                        }

                      </td>


                      {/* END */}

                      <td
                        className="
                          text-nowrap
                        "
                        style={
                          cellStyle
                        }
                      >

                        {
                          formatDateTimeIST(
                            getSessionEnd(
                              session
                            )
                          )
                        }

                      </td>


                      {/* DURATION */}

                      <td
                        className="
                          text-center
                          pe-4
                          text-nowrap
                        "
                        style={{
                          ...cellStyle,
                          fontWeight:
                            600,
                        }}
                      >

                        {
                          formatDurationShort(
                            getSessionDurationSeconds(
                              session
                            )
                          )
                        }

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
                  '1px solid #d9e1e8',
                backgroundColor:
                  '#f8fafc',
                minHeight:
                  58,
              }}
            >

              {/* ==================================================
                  RECORD COUNT
                  ================================================== */}

              <div
                style={{
                  color:
                    '#64748B',
                  fontSize:
                    12,
                }}
              >

                Showing{' '}

                <strong
                  style={{
                    color:
                      '#334155',
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
                      '#334155',
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
                      '#334155',
                  }}
                >
                  {
                    totalElements
                  }
                </strong>

                {' activity records'}

              </div>


              {/* ==================================================
                  PAGINATION CONTROLS
                  ================================================== */}

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
                      '1px solid #CBD5E1',

                    color:
                      currentPage ===
                      0
                        ? '#CBD5E1'
                        : '#334155',

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
                  aria-label="
                    Previous page
                  "
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
                      90,
                    height:
                      32,
                    fontSize:
                      12,
                    color:
                      '#334155',
                    fontWeight:
                      500,
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
                      '1px solid #CBD5E1',

                    color:
                      currentPage >=
                      totalPages -
                        1
                        ? '#CBD5E1'
                        : '#334155',

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
                  aria-label="
                    Next page
                  "
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