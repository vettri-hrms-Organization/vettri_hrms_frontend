import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Search,
  Download,
  ArrowUpDown,
  PlusCircle,
  Users,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { employeeSalaryApi } from '../../api/endpoints/salary';
import { departmentsApi } from '../../api/endpoints/organization';
import {
  SELECTABLE_STATUSES,
  statusMeta,
} from '../employees/statusMeta';

import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';

import { formatCurrency } from '../../utils/formatCurrency';
import { exportToCsv } from '../../utils/exportToCsv';

import PayrollStatusBadge from './components/PayrollStatusBadge';
import AssignSalaryStructureModal from './components/AssignSalaryStructureModal';


/* ============================================================
   CONSTANTS
   ============================================================ */

const PAGE_SIZE = 10;

const HEADER_COLOR = '#0B2342';


/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function EmployeeSalaryList() {

  /* ==========================================================
     STATE
     ========================================================== */

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    departmentId,
    setDepartmentId,
  ] = useState('');

  const [
    status,
    setStatus,
  ] = useState('');

  const [
    sortBy,
    setSortBy,
  ] = useState('employeeName');

  const [
    sortDir,
    setSortDir,
  ] = useState('asc');

  const [
    page,
    setPage,
  ] = useState(0);

  const [
    assigningFor,
    setAssigningFor,
  ] = useState(null);


  /* ==========================================================
     DEPARTMENTS
     ========================================================== */

  const {
    data: departments = [],
  } = useQuery({
    queryKey: [
      'departments',
    ],

    queryFn:
      departmentsApi.list,
  });


  /* ==========================================================
     EMPLOYEE SALARY DATA
     ========================================================== */

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({

    queryKey: [
      'salary-employees',
      search,
      departmentId,
      status,
      sortBy,
      sortDir,
      page,
    ],

    queryFn: () =>
      employeeSalaryApi.list({

        search,

        departmentId:
          departmentId ||
          undefined,

        status:
          status ||
          undefined,

        sortBy,

        sortDir,

        page,

        size:
          PAGE_SIZE,

      }),

  });


  /* ==========================================================
     DATA
     ========================================================== */

  const rows =
    data?.content ||
    [];

  const totalPages =
    Math.max(
      data?.totalPages ??
        0,
      1
    );

  const totalElements =
    data?.totalElements ??
    0;


  /* ==========================================================
     SAFE PAGE
     ========================================================== */

  const currentPage =
    Math.min(
      page,
      totalPages - 1
    );


  /* ==========================================================
     RECORD RANGE
     ========================================================== */

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
     SORT
     ========================================================== */

  function toggleSort(
    column
  ) {

    if (
      sortBy ===
      column
    ) {

      setSortDir(
        (current) =>
          current ===
          'asc'
            ? 'desc'
            : 'asc'
      );

    } else {

      setSortBy(
        column
      );

      setSortDir(
        'asc'
      );
    }

    setPage(0);
  }


  /* ==========================================================
     SEARCH
     ========================================================== */

  function handleSearch(
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
     DEPARTMENT FILTER
     ========================================================== */

  function handleDepartmentChange(
    value
  ) {

    setDepartmentId(
      value
    );

    setPage(0);
  }


  /* ==========================================================
     STATUS FILTER
     ========================================================== */

  function handleStatusChange(
    value
  ) {

    setStatus(
      value
    );

    setPage(0);
  }


  /* ==========================================================
     EXPORT
     ========================================================== */

  function handleExport() {

    exportToCsv(

      `employee-salary-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`,

      rows.map(
        (row) => ({

          'Employee ID':
            row.employeeCode,

          'Employee Name':
            row.employeeName,

          Department:
            row.departmentName ||
            '',

          Designation:
            row.designationTitle ||
            '',

          'Basic Salary':
            row.basicSalary,

          'Gross Salary':
            row.grossSalary,

          'Net Salary':
            row.netSalary,

          'Payroll Status':
            row.payrollStatus,

          'Last Payroll Date':
            row.lastPayrollDate ||
            '',

        })
      )
    );
  }


  /* ==========================================================
     TABLE COLUMNS
     ========================================================== */

  const columns =
    useMemo(
      () => [

        {
          key:
            'employeeName',

          label:
            'Employee',
        },

        {
          key:
            'department',

          label:
            'Department',
        },

        {
          key:
            'basicSalary',

          label:
            'Basic Salary',
        },

        {
          key:
            'grossSalary',

          label:
            'Gross Salary',
        },

        {
          key:
            'netSalary',

          label:
            'Net Salary',
        },

        {
          key:
            'payrollStatus',

          label:
            'Payroll Status',
        },

        {
          key:
            'lastPayrollDate',

          label:
            'Last Payroll Date',
        },

      ],
      []
    );


  /* ==========================================================
     TABLE HEADER STYLE
     ========================================================== */

  const headerStyle = {

    height:
      44,

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

    textTransform:
      'uppercase',

    letterSpacing:
      '0.04em',

    whiteSpace:
      'nowrap',

    verticalAlign:
      'middle',

  };


  /* ==========================================================
     TABLE CELL STYLE
     ========================================================== */

  const cellStyle = {

    height:
      50,

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
        hz-module-page
        hz-module-page--payroll
        d-flex
        flex-column
        gap-4
      "
    >

      {/* ======================================================
          PAGE HEADER
          ====================================================== */}

      <div
        className="
          d-flex
          flex-wrap
          align-items-center
          justify-content-between
          gap-3
        "
      >

        <div>

          <h1
            style={{
              fontSize:
                'var(--hz-text-2xl)',
              fontWeight:
                700,
              marginBottom:
                4,
              color:
                HEADER_COLOR,
            }}
          >
            Employee Salary
          </h1>


          <p
            className="
              text-secondary-hz
              mb-0
            "
            style={{
              fontSize:
                'var(--hz-text-sm)',
            }}
          >

            {totalElements}{' '}

            employee
            {totalElements ===
            1
              ? ''
              : 's'}{' '}

            in the payroll roster

          </p>

        </div>


        {/* ====================================================
            HEADER ACTIONS
            ==================================================== */}

        <div
          className="
            d-flex
            gap-2
            flex-wrap
          "
        >

          <button
            type="button"
            className="
              btn
              btn-outline-secondary
              d-inline-flex
              align-items-center
              gap-2
            "
            onClick={
              handleExport
            }
            disabled={
              rows.length ===
              0
            }
          >

            <Download
              size={16}
            />

            Export

          </button>


          <Link
            to="/salary/structure"
            className="
              btn
              btn-primary
              d-inline-flex
              align-items-center
              gap-2
            "
          >

            <PlusCircle
              size={16}
            />

            Define Structure

          </Link>

        </div>

      </div>


      {/* ======================================================
          FILTER CARD
          ====================================================== */}

      <Card
        bodyClassName="p-3"
      >

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
                left:
                  14,
                top:
                  '50%',
                transform:
                  'translateY(-50%)',
                color:
                  '#64748B',
                pointerEvents:
                  'none',
                zIndex:
                  2,
              }}
            />


            <input
              type="search"
              className="
                form-control
                ps-5
                pe-5
              "
              placeholder="
                Search employee by name, code or email...
              "
              aria-label="
                Search employee salary
              "
              value={
                search
              }
              onChange={
                (event) =>
                  handleSearch(
                    event.target.value
                  )
              }
              style={{
                height:
                  42,
                borderRadius:
                  8,
                borderColor:
                  '#CBD5E1',
                fontSize:
                  13,
                boxShadow:
                  'none',
              }}
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
                  right:
                    8,
                  top:
                    '50%',
                  transform:
                    'translateY(-50%)',
                  width:
                    28,
                  height:
                    28,
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


          {/* ==================================================
              FILTERS
              ================================================== */}

          <div
            className="
              row
              g-2
            "
          >

            {/* DEPARTMENT */}

            <div
              className="
                col-12
                col-md-4
              "
            >

              <select
                className="
                  form-select
                "
                value={
                  departmentId
                }
                onChange={
                  (event) =>
                    handleDepartmentChange(
                      event.target.value
                    )
                }
                style={{
                  height:
                    40,
                  fontSize:
                    13,
                  borderRadius:
                    8,
                  borderColor:
                    '#CBD5E1',
                }}
              >

                <option value="">
                  All Departments
                </option>

                {departments.map(
                  (
                    department
                  ) => (

                    <option
                      key={
                        department.id
                      }
                      value={
                        department.id
                      }
                    >

                      {
                        department.name
                      }

                    </option>

                  )
                )}

              </select>

            </div>


            {/* STATUS */}

            <div
              className="
                col-12
                col-md-4
              "
            >

              <select
                className="
                  form-select
                "
                value={
                  status
                }
                onChange={
                  (event) =>
                    handleStatusChange(
                      event.target.value
                    )
                }
                style={{
                  height:
                    40,
                  fontSize:
                    13,
                  borderRadius:
                    8,
                  borderColor:
                    '#CBD5E1',
                }}
              >

                <option value="">
                  Any Employment Status
                </option>

                {SELECTABLE_STATUSES.map(
                  (
                    currentStatus
                  ) => (

                    <option
                      key={
                        currentStatus
                      }
                      value={
                        currentStatus
                      }
                    >

                      {
                        statusMeta(
                          currentStatus
                        ).label
                      }

                    </option>

                  )
                )}

              </select>

            </div>


            {/* RESULT INFO */}

            <div
              className="
                col-12
                col-md-4
                d-flex
                align-items-center
              "
            >

              <div
                className="
                  d-flex
                  align-items-center
                  gap-2
                "
                style={{
                  height:
                    40,
                  color:
                    '#64748B',
                  fontSize:
                    12,
                }}
              >

                <Users
                  size={15}
                />

                <span>

                  {totalElements}{' '}

                  employee
                  {totalElements ===
                  1
                    ? ''
                    : 's'}{' '}

                  found

                </span>

              </div>

            </div>

          </div>

        </div>

      </Card>


      {/* ======================================================
          ERROR
          ====================================================== */}

      {isError && (

        <ErrorState
          description="
            Couldn't load the salary list.
          "
          onRetry={
            refetch
          }
        />

      )}


      {/* ======================================================
          SALARY TABLE
          ====================================================== */}

      {!isError && (

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
                  '#d9e1e8',
                fontSize:
                  12,
              }}
            >

              {/* ==================================================
                  HEADER
                  ================================================== */}

              <thead>

                <tr>

                  {columns.map(
                    (
                      column
                    ) => (

                      <th
                        key={
                          column.key
                        }
                        scope="col"
                        className="
                          px-3
                          py-3
                        "
                        style={{
                          ...headerStyle,
                          cursor:
                            'pointer',
                        }}
                        onClick={() =>
                          toggleSort(
                            column.key
                          )
                        }
                      >

                        <span
                          className="
                            d-inline-flex
                            align-items-center
                            gap-1
                          "
                        >

                          {
                            column.label
                          }


                          <ArrowUpDown
                            size={12}
                            style={{
                              opacity:
                                sortBy ===
                                column.key
                                  ? 1
                                  : 0.35,
                            }}
                          />

                        </span>

                      </th>

                    )
                  )}


                  {/* ACTION */}

                  <th
                    scope="col"
                    className="
                      px-3
                      py-3
                      text-center
                    "
                    style={
                      headerStyle
                    }
                  >
                    Action
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

                {isLoading &&

                  Array.from({
                    length:
                      PAGE_SIZE,
                  }).map(
                    (
                      _,
                      rowIndex
                    ) => (

                      <tr
                        key={
                          rowIndex
                        }
                      >

                        {Array.from({
                          length:
                            8,
                        }).map(
                          (
                            __,
                            columnIndex
                          ) => (

                            <td
                              key={
                                columnIndex
                              }
                              className="
                                px-3
                                py-3
                              "
                              style={
                                cellStyle
                              }
                            >

                              <Skeleton
                                height={
                                  14
                                }
                              />

                            </td>

                          )
                        )}

                      </tr>

                    )
                  )}


                {/* =================================================
                    DATA
                    ================================================= */}

                {!isLoading &&
                  rows.map(
                    (
                      row
                    ) => (

                      <tr
                        key={
                          row.employeeId
                        }
                      >

                        {/* EMPLOYEE */}

                        <td
                          className="
                            px-3
                            py-3
                          "
                          style={{
                            ...cellStyle,
                            minWidth:
                              240,
                          }}
                        >

                          <Link
                            to={
                              `/salary/employees/${row.employeeId}`
                            }
                            className="
                              d-flex
                              align-items-center
                              gap-2
                              text-decoration-none
                            "
                          >

                            <Avatar
                              name={
                                row.employeeName
                              }
                              src={
                                row.profilePhotoUrl
                              }
                              size="sm"
                            />


                            <div>

                              <div
                                style={{
                                  fontWeight:
                                    600,
                                  color:
                                    HEADER_COLOR,
                                  fontSize:
                                    13,
                                }}
                              >

                                {
                                  row.employeeName
                                }

                              </div>


                              <div
                                style={{
                                  fontSize:
                                    11,
                                  color:
                                    '#64748B',
                                  marginTop:
                                    2,
                                }}
                              >

                                {
                                  row.employeeCode
                                }

                              </div>

                            </div>

                          </Link>

                        </td>


                        {/* DEPARTMENT */}

                        <td
                          className="
                            px-3
                            py-3
                          "
                          style={
                            cellStyle
                          }
                        >

                          <div
                            style={{
                              fontWeight:
                                500,
                            }}
                          >

                            {
                              row.departmentName ||
                              '—'
                            }

                          </div>


                          {row.designationTitle && (

                            <div
                              style={{
                                fontSize:
                                  11,
                                color:
                                  '#64748B',
                                marginTop:
                                  2,
                              }}
                            >

                              {
                                row.designationTitle
                              }

                            </div>

                          )}

                        </td>


                        {/* BASIC SALARY */}

                        <td
                          className="
                            px-3
                            py-3
                            text-nowrap
                          "
                          style={
                            cellStyle
                          }
                        >

                          {
                            formatCurrency(
                              row.basicSalary
                            )
                          }

                        </td>


                        {/* GROSS SALARY */}

                        <td
                          className="
                            px-3
                            py-3
                            text-nowrap
                          "
                          style={
                            cellStyle
                          }
                        >

                          {
                            formatCurrency(
                              row.grossSalary
                            )
                          }

                        </td>


                        {/* NET SALARY */}

                        <td
                          className="
                            px-3
                            py-3
                            text-nowrap
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
                            formatCurrency(
                              row.netSalary
                            )
                          }

                        </td>


                        {/* PAYROLL STATUS */}

                        <td
                          className="
                            px-3
                            py-3
                            text-nowrap
                          "
                          style={
                            cellStyle
                          }
                        >

                          <PayrollStatusBadge
                            status={
                              row.payrollStatus
                            }
                          />

                        </td>


                        {/* LAST PAYROLL DATE */}

                        <td
                          className="
                            px-3
                            py-3
                            text-nowrap
                          "
                          style={
                            cellStyle
                          }
                        >

                          {
                            row.lastPayrollDate
                              ? new Date(
                                  row.lastPayrollDate
                                ).toLocaleDateString(
                                  'en-IN'
                                )
                              : '—'
                          }

                        </td>


                        {/* ACTION */}

                        <td
                          className="
                            px-3
                            py-3
                            text-center
                            text-nowrap
                          "
                          style={
                            cellStyle
                          }
                        >

                          <button
                            type="button"
                            className="
                              btn
                              btn-sm
                              btn-outline-secondary
                            "
                            onClick={() =>
                              setAssigningFor(
                                row
                              )
                            }
                          >

                            {
                              row.structureConfigured
                                ? 'Revise'
                                : 'Assign'
                            }

                          </button>

                        </td>

                      </tr>

                    )
                  )}

              </tbody>

            </table>

          </div>


          {/* ====================================================
              EMPTY STATE
              ==================================================== */}

          {!isLoading &&
            rows.length ===
              0 && (

              <div
                className="
                  p-4
                "
              >

                <EmptyState
                  icon={
                    Users
                  }
                  title="
                    No employees match these filters
                  "
                  description="
                    Try clearing the search or filters above.
                  "
                />

              </div>

            )}


          {/* ====================================================
              PAGINATION
              ==================================================== */}

          {!isLoading &&
            totalElements >
              0 && (

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

                  {' employees'}

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


                  {/* PAGE */}

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
                        '#475569',
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

      )}


      {/* ========================================================
          ASSIGN SALARY STRUCTURE MODAL
          ======================================================== */}

      {assigningFor && (

        <AssignSalaryStructureModal
          employee={
            assigningFor
          }
          onClose={
            (saved) => {

              setAssigningFor(
                null
              );

              if (saved) {
                refetch();
              }

            }
          }
        />

      )}

    </div>
  );
}