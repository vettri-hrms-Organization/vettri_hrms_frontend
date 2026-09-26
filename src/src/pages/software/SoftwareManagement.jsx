import { useEffect, useMemo, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  Boxes,
  Check,
  Circle,
  Download,
  Eye,
  LoaderCircle,
  PackagePlus,
  Rocket,
  UploadCloud,
  X,
} from 'lucide-react';

import { softwareApi } from '../../api/endpoints/software';

import {
  monitoringApi,
  getDeviceId,
  getDeviceName,
  getDeviceEmployeeName,
} from '../../api/endpoints/monitoring';

import { useAuth } from '../../hooks/useAuth';

import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import PageHeader from '../../components/ui/PageHeader';
import ErrorBanner from '../../components/ui/ErrorBanner';
import Dialog from '../../components/ui/Dialog';


/* ============================================================
   CONSTANTS
   ============================================================ */

const DEPLOYMENT_PAGE_SIZE = 5;


/* ============================================================
   STATUS VARIANT
   ============================================================ */

function statusVariant(status) {
  if (
    status === 'COMPLETED' ||
    status === 'INSTALLED' ||
    status === 'ALREADY_INSTALLED'
  ) {
    return 'success';
  }

  if (status === 'FAILED') {
    return 'danger';
  }

  if (
    [
      'DEVICE_REACHED',
      'JOB_RECEIVED',
      'DOWNLOADING',
      'DOWNLOAD_VERIFIED',
      'INSTALLING',
      'INSTALLATION_COMPLETED',
      'VERIFYING',
    ].includes(status)
  ) {
    return 'warning';
  }

  return 'neutral';
}


/* ============================================================
   TIMELINE STAGES
   ============================================================ */

const TIMELINE_STAGES = [
  {
    key: 'DEPLOYMENT_QUEUED',
    label: 'Deployment queued',
  },
  {
    key: 'DEVICE_REACHED',
    label: 'Device reached',
  },
  {
    key: 'JOB_RECEIVED',
    label: 'Deployment received',
  },
  {
    key: 'DOWNLOADING',
    label: 'Installer downloading',
  },
  {
    key: 'DOWNLOAD_VERIFIED',
    label: 'Download verified',
  },
  {
    key: 'INSTALLING',
    label: 'Installation started',
  },
  {
    key: 'INSTALLATION_COMPLETED',
    label: 'Installation completed',
  },
  {
    key: 'VERIFYING',
    label: 'Application verified',
  },
  {
    key: 'COMPLETED',
    label: 'Completed',
  },
];


/* ============================================================
   BUILD TIMELINE
   ============================================================ */

function buildTimeline(target) {
  const events = target?.stages || [];

  const eventByStatus = new Map(
    events.map((event) => [
      event.status,
      event,
    ])
  );

  const failure = [...events]
    .reverse()
    .find(
      (event) =>
        event.status === 'FAILED'
    );

  const lastReached =
    TIMELINE_STAGES.reduce(
      (
        index,
        stage,
        stageIndex
      ) => (
        eventByStatus.has(
          stage.key
        )
          ? stageIndex
          : index
      ),
      -1
    );

  const failureIndex = failure
    ? Math.max(
        0,
        lastReached
      )
    : -1;

  return TIMELINE_STAGES.map(
    (
      stage,
      index
    ) => {
      const event =
        eventByStatus.get(
          stage.key
        );

      const state =
        failure &&
        index === failureIndex
          ? 'failed'
          : target?.status ===
              stage.key &&
            stage.key !==
              'COMPLETED'
            ? 'active'
            : event
              ? 'completed'
              : 'not-started';

      return {
        ...stage,
        state,
        event:
          state === 'failed'
            ? failure
            : event,
      };
    }
  );
}


/* ============================================================
   STAGE ICON
   ============================================================ */

function StageIcon({ state }) {
  if (state === 'completed') {
    return <Check size={15} />;
  }

  if (state === 'active') {
    return (
      <LoaderCircle
        size={15}
        className="spin"
      />
    );
  }

  if (state === 'failed') {
    return <X size={15} />;
  }

  return <Circle size={13} />;
}


/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function SoftwareManagement() {

  const queryClient =
    useQueryClient();

  const {
    hasPermission,
  } = useAuth();


  /* ==========================================================
     PERMISSIONS
     ========================================================== */

  const canViewSoftware =
    hasPermission(
      'SOFTWARE_VIEW'
    );

  const canManageSoftware =
    hasPermission(
      'SOFTWARE_MANAGE'
    );

  const canDeploySoftware =
    hasPermission(
      'SOFTWARE_DEPLOY'
    ) ||
    canManageSoftware;


  /* ==========================================================
     STATE
     ========================================================== */

  const [
    selectedPackageId,
    setSelectedPackageId,
  ] = useState('');

  const [
    selectedVersionId,
    setSelectedVersionId,
  ] = useState('');

  const [
    selectedDevices,
    setSelectedDevices,
  ] = useState([]);

  const [
    packageName,
    setPackageName,
  ] = useState('');

  const [
    version,
    setVersion,
  ] = useState('');

  const [
    installer,
    setInstaller,
  ] = useState(null);

  const [
    detectionRule,
    setDetectionRule,
  ] = useState('');

  const [
    silentInstallArguments,
    setSilentInstallArguments,
  ] = useState('');

  const [
    error,
    setError,
  ] = useState('');

  const [
    selectedDeploymentId,
    setSelectedDeploymentId,
  ] = useState(null);

  const [
    selectedTarget,
    setSelectedTarget,
  ] = useState(null);

  /* Deployment History pagination */
  const [
    deploymentPage,
    setDeploymentPage,
  ] = useState(1);


  /* ==========================================================
     SOFTWARE PACKAGES
     ========================================================== */

  const packages =
    useQuery({
      queryKey: [
        'software-packages',
      ],

      queryFn:
        softwareApi.packages,

      enabled:
        canViewSoftware,
    });


  /* ==========================================================
     DEVICES
     ========================================================== */

  const devices =
    useQuery({
      queryKey: [
        'monitoring-devices',
      ],

      queryFn:
        monitoringApi.devices,

      enabled:
        canViewSoftware ||
        canDeploySoftware,
    });


  /* ==========================================================
     SOFTWARE VERSIONS
     ========================================================== */

  const versions =
    useQuery({
      queryKey: [
        'software-versions',
        selectedPackageId,
      ],

      queryFn: () =>
        softwareApi.versions(
          selectedPackageId
        ),

      enabled:
        canViewSoftware &&
        Boolean(
          selectedPackageId
        ),
    });


  /* ==========================================================
     DEPLOYMENTS
     ========================================================== */

  const deployments =
    useQuery({
      queryKey: [
        'software-deployments',
      ],

      queryFn:
        softwareApi.deployments,

      enabled:
        canViewSoftware ||
        canDeploySoftware,

      refetchInterval:
        15_000,
    });


  /* ==========================================================
     DEPLOYMENT TARGETS
     ========================================================== */

  const deploymentTargets =
    useQuery({
      queryKey: [
        'software-deployment-targets',
        selectedDeploymentId,
      ],

      queryFn: () =>
        softwareApi.deploymentTargets(
          selectedDeploymentId
        ),

      enabled:
        (
          canViewSoftware ||
          canDeploySoftware
        ) &&
        Boolean(
          selectedDeploymentId
        ),

      refetchInterval:
        15_000,
    });


  /* ==========================================================
     CREATE PACKAGE
     ========================================================== */

  const createPackage =
    useMutation({
      mutationFn: () =>
        softwareApi.createPackage({
          name:
            packageName.trim(),

          platform:
            'WINDOWS',

          active:
            true,
        }),

      onSuccess: (
        created
      ) => {

        setPackageName('');

        setSelectedPackageId(
          String(
            created.id
          )
        );

        queryClient.invalidateQueries({
          queryKey: [
            'software-packages',
          ],
        });
      },

      onError: (
        err
      ) => {

        setError(
          err?.response?.data
            ?.message ||
          'Could not create the software package.'
        );
      },
    });


  /* ==========================================================
     CREATE VERSION
     ========================================================== */

  const createVersion =
    useMutation({
      mutationFn: () =>
        softwareApi.createVersion(

          selectedPackageId,

          {
            version:
              version.trim(),

            installerType:
              'INNO_SETUP',

            detectionRule,

            silentInstallArguments:
              silentInstallArguments
                .trim() ||
              null,

            active:
              true,
          },

          installer
        ),

      onSuccess: () => {

        setVersion('');

        setInstaller(null);

        setDetectionRule('');

        setSilentInstallArguments('');

        queryClient.invalidateQueries({
          queryKey: [
            'software-versions',
            selectedPackageId,
          ],
        });
      },

      onError: (
        err
      ) => {

        setError(
          err?.response?.data
            ?.message ||
          'Could not create the software version.'
        );
      },
    });


  /* ==========================================================
     CREATE DEPLOYMENT
     ========================================================== */

  const createDeployment =
    useMutation({
      mutationFn: () =>
        softwareApi.createDeployment({
          softwareVersionId:
            Number(
              selectedVersionId
            ),

          targetDeviceIds:
            selectedDevices.map(
              Number
            ),
        }),

      onSuccess: () => {

        setSelectedDevices([]);

        setSelectedVersionId('');

        /*
         * Return to first page after
         * creating a new deployment.
         */
        setDeploymentPage(1);

        queryClient.invalidateQueries({
          queryKey: [
            'software-deployments',
          ],
        });
      },

      onError: (
        err
      ) => {

        setError(
          err?.response?.data
            ?.message ||
          'Could not queue the deployment.'
        );
      },
    });


  /* ==========================================================
     SELECTED VERSION
     ========================================================== */

  const selectedVersion =
    useMemo(
      () =>
        (
          versions.data ||
          []
        ).find(
          (item) =>
            String(item.id) ===
            String(
              selectedVersionId
            )
        ),

      [
        versions.data,
        selectedVersionId,
      ]
    );


  /* ==========================================================
     SORT DEPLOYMENTS
     ========================================================== */

  const sortedDeployments =
    useMemo(() => {

      return [
        ...(deployments.data || []),
      ].sort(
        (a, b) =>
          new Date(
            b.startedAt ||
            b.createdAt ||
            0
          ) -
          new Date(
            a.startedAt ||
            a.createdAt ||
            0
          )
      );

    }, [
      deployments.data,
    ]);


  /* ==========================================================
     DEPLOYMENT PAGE COUNT
     ========================================================== */

  const totalDeploymentPages =
    Math.max(
      1,
      Math.ceil(
        sortedDeployments.length /
          DEPLOYMENT_PAGE_SIZE
      )
    );


  /* ==========================================================
     SAFE PAGE
     ========================================================== */

  const safeDeploymentPage =
    Math.min(
      deploymentPage,
      totalDeploymentPages
    );


  /* ==========================================================
     PAGINATED DEPLOYMENTS
     ========================================================== */

  const paginatedDeployments =
    useMemo(() => {

      const start =
        (
          safeDeploymentPage -
          1
        ) *
        DEPLOYMENT_PAGE_SIZE;

      return sortedDeployments.slice(
        start,
        start +
          DEPLOYMENT_PAGE_SIZE
      );

    }, [
      sortedDeployments,
      safeDeploymentPage,
    ]);


  /* ==========================================================
     PAGINATION COUNTER
     ========================================================== */

  const deploymentStartIndex =
    sortedDeployments.length === 0
      ? 0
      : (
          safeDeploymentPage -
          1
        ) *
          DEPLOYMENT_PAGE_SIZE +
        1;


  const deploymentEndIndex =
    Math.min(
      safeDeploymentPage *
        DEPLOYMENT_PAGE_SIZE,
      sortedDeployments.length
    );


  /* ==========================================================
     RESET PAGINATION WHEN DATA CHANGES
     ========================================================== */

  useEffect(() => {

    setDeploymentPage(
      (currentPage) =>
        Math.min(
          Math.max(
            currentPage,
            1
          ),
          totalDeploymentPages
        )
    );

  }, [
    sortedDeployments.length,
    totalDeploymentPages,
  ]);


  /* ==========================================================
     GO TO PAGE
     ========================================================== */

  const goToDeploymentPage =
    (page) => {

      setDeploymentPage(
        Math.max(
          1,
          Math.min(
            page,
            totalDeploymentPages
          )
        )
      );
    };


  /* ==========================================================
     PERMISSION CHECK
     ========================================================== */

  if (
    !canViewSoftware &&
    !canDeploySoftware &&
    !canManageSoftware
  ) {
    return null;
  }


  /* ==========================================================
     PACKAGE COLUMNS
     ========================================================== */

  const packageColumns = [

    {
      key: 'name',

      label: 'Package',

      render: (
        item
      ) => (
        <strong>
          {item.name}
        </strong>
      ),
    },


    {
      key: 'publisher',

      label: 'Publisher',

      render: (
        item
      ) =>
        item.publisher ||
        '—',
    },


    {
      key: 'platform',

      label: 'Platform',

      render: (
        item
      ) => (
        <Badge
          variant="primary"
        >
          {item.platform}
        </Badge>
      ),
    },


    {
      key: 'active',

      label: 'State',

      render: (
        item
      ) => (
        <Badge
          variant={
            item.active
              ? 'success'
              : 'neutral'
          }
        >
          {item.active
            ? 'Active'
            : 'Inactive'}
        </Badge>
      ),
    },

  ];


  /* ==========================================================
     RENDER
     ========================================================== */

  return (

    <div
      className="
        d-flex
        flex-column
        gap-4
        hz-software-center
      "
    >

      {/* ======================================================
          PAGE HEADER
          ====================================================== */}

      <PageHeader
        eyebrow="Software Management"
        title="Software deployment"
        description="Manage approved Windows packages and deploy them to enrolled devices."
      />


      {/* ======================================================
          ERROR
          ====================================================== */}

      {error && (
        <ErrorBanner>
          {error}
        </ErrorBanner>
      )}


      {/* ======================================================
          PACKAGE + INSTALLER
          ====================================================== */}

      <div className="row g-4">


        {/* ====================================================
            SOFTWARE CATALOG
            ==================================================== */}

        <div className="col-xl-5">

          <Card
            title="Software catalog"
            icon={Boxes}
          >

            <Table
              columns={
                packageColumns
              }

              rows={
                packages.data ||
                []
              }

              getRowKey={
                (item) =>
                  item.id
              }

              isLoading={
                packages.isLoading
              }

              isError={
                packages.isError
              }

              onRetry={
                packages.refetch
              }

              emptyIcon={
                Boxes
              }

              emptyTitle={
                "No packages yet"
              }

              emptyDescription={
                "Add the first approved Windows package below."
              }
            />


            <form
              className="
                d-flex
                gap-2
                mt-4
              "
              onSubmit={
                (event) => {

                  event.preventDefault();

                  setError('');

                  createPackage.mutate();
                }
              }
            >

              <input
                className="form-control"
                value={
                  packageName
                }
                onChange={
                  (event) =>
                    setPackageName(
                      event.target.value
                    )
                }
                placeholder="Package name"
                maxLength={150}
                required
              />


              <Button
                type="submit"
                icon={PackagePlus}
                loading={
                  createPackage.isPending
                }
                disabled={
                  !canManageSoftware ||
                  !packageName.trim()
                }
              >
                Add
              </Button>

            </form>

          </Card>

        </div>


        {/* ====================================================
            INSTALLER VERSION
            ==================================================== */}

        <div className="col-xl-7">

          <Card
            title="Installer version"
            icon={UploadCloud}
          >

            <div className="row g-3">


              <div className="col-md-5">

                <label className="hz-form-label">

                  Package

                  <select
                    className="form-select mt-1"
                    value={
                      selectedPackageId
                    }
                    onChange={
                      (event) => {

                        setSelectedPackageId(
                          event.target.value
                        );

                        setSelectedVersionId(
                          ''
                        );
                      }
                    }
                  >

                    <option value="">
                      Choose package
                    </option>

                    {
                      (
                        packages.data ||
                        []
                      ).map(
                        (item) => (

                          <option
                            key={
                              item.id
                            }
                            value={
                              item.id
                            }
                          >
                            {item.name}
                          </option>

                        )
                      )
                    }

                  </select>

                </label>

              </div>


              <div className="col-md-7">

                <label className="hz-form-label">

                  Inno Setup installer

                  <input
                    className="form-control mt-1"
                    type="file"
                    accept=".exe,application/vnd.microsoft.portable-executable"
                    onChange={
                      (event) =>
                        setInstaller(
                          event.target.files?.[0] ||
                          null
                        )
                    }
                    required
                  />

                </label>

              </div>


              <div className="col-md-4">

                <label className="hz-form-label">

                  Version

                  <input
                    className="form-control mt-1"
                    value={
                      version
                    }
                    onChange={
                      (event) =>
                        setVersion(
                          event.target.value
                        )
                    }
                    placeholder="e.g. 12.4.1"
                    required
                  />

                </label>

              </div>


              <div className="col-md-8">

                <label className="hz-form-label">

                  Detection rule

                  <input
                    className="form-control mt-1"
                    value={
                      detectionRule
                    }
                    onChange={
                      (event) =>
                        setDetectionRule(
                          event.target.value
                        )
                    }
                    placeholder="REGISTRY_UNINSTALL|Application Name"
                    required
                  />

                </label>

              </div>


              <div className="col-md-4">

                <label className="hz-form-label">

                  Silent install arguments

                  <input
                    className="form-control mt-1"
                    value={
                      silentInstallArguments
                    }
                    onChange={
                      (event) =>
                        setSilentInstallArguments(
                          event.target.value
                        )
                    }
                    placeholder="Optional: /VERYSILENT"
                  />

                </label>

              </div>


              <div className="col-12">

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
                  The server calculates the
                  SHA-256 checksum. The agent
                  uses fixed approved Inno Setup
                  silent flags and verifies the
                  configured registry or file
                  detection rule after installation.
                </p>

              </div>


              <div className="col-12">

                <Button
                  icon={UploadCloud}
                  onClick={() => {

                    setError('');

                    if (
                      canManageSoftware
                    ) {
                      createVersion.mutate();
                    }

                  }}
                  loading={
                    createVersion.isPending
                  }
                  disabled={
                    !canManageSoftware ||
                    !selectedPackageId ||
                    !version.trim() ||
                    !installer ||
                    !detectionRule.trim()
                  }
                >
                  Upload and register installer
                </Button>

              </div>

            </div>


            {/* REGISTERED VERSIONS */}

            {selectedPackageId && (

              <div className="mt-4">

                <div
                  className="
                    text-secondary-hz
                    mb-2
                  "
                >
                  Registered versions
                </div>


                <div
                  className="
                    d-flex
                    flex-wrap
                    gap-2
                  "
                >

                  {
                    (
                      versions.data ||
                      []
                    ).map(
                      (item) => (

                        <button
                          type="button"
                          key={
                            item.id
                          }
                          className={
                            `btn btn-sm ${
                              String(
                                item.id
                              ) ===
                              String(
                                selectedVersionId
                              )
                                ? 'btn-primary'
                                : 'btn-outline-secondary'
                            }`
                          }
                          onClick={() =>
                            setSelectedVersionId(
                              String(
                                item.id
                              )
                            )
                          }
                        >
                          {item.version}
                        </button>

                      )
                    )
                  }

                </div>

              </div>

            )}

          </Card>

        </div>

      </div>


      {/* ========================================================
          DEPLOY TO DEVICES
          ======================================================== */}

      <Card
        title="Deploy to devices"
        icon={Rocket}
      >

        <div
          className="
            row
            g-3
            align-items-end
          "
        >

          <div className="col-md-4">

            <label className="hz-form-label">

              Version

              <select
                className="form-select mt-1"
                value={
                  selectedVersionId
                }
                onChange={
                  (event) =>
                    setSelectedVersionId(
                      event.target.value
                    )
                }
                disabled={
                  !selectedPackageId
                }
              >

                <option value="">
                  Choose version
                </option>

                {
                  (
                    versions.data ||
                    []
                  ).map(
                    (item) => (

                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {item.version}
                      </option>

                    )
                  )
                }

              </select>

            </label>

          </div>


          <div className="col-md-6">

            <label className="hz-form-label">

              Target devices

              <select
                multiple
                className="form-select mt-1"
                style={{
                  minHeight: 92,
                }}
                value={
                  selectedDevices
                }
                onChange={
                  (event) =>
                    setSelectedDevices(
                      Array.from(
                        event.target
                          .selectedOptions,
                        (option) =>
                          option.value
                      )
                    )
                }
              >

                {
                  (
                    devices.data ||
                    []
                  ).map(
                    (device) => (

                      <option
                        key={
                          getDeviceId(
                            device
                          )
                        }
                        value={
                          getDeviceId(
                            device
                          )
                        }
                      >

                        {getDeviceName(
                          device
                        )}

                        {
                          getDeviceEmployeeName(
                            device
                          )
                            ? ` · ${getDeviceEmployeeName(
                                device
                              )}`
                            : ''
                        }

                      </option>

                    )
                  )
                }

              </select>

            </label>

          </div>


          <div className="col-md-2">

            <Button
              icon={Rocket}
              onClick={() => {

                setError('');

                if (
                  canDeploySoftware
                ) {
                  createDeployment.mutate();
                }

              }}
              loading={
                createDeployment.isPending
              }
              disabled={
                !canDeploySoftware ||
                !selectedVersion ||
                selectedDevices.length === 0
              }
            >
              Queue deployment
            </Button>

          </div>

        </div>

      </Card>


      {/* ========================================================
          DEPLOYMENT HISTORY
          ======================================================== */}

      <Card
        title="Deployment history"
        icon={Download}
        bodyClassName="p-0"
      >

        {/* ======================================================
            SUMMARY
            ====================================================== */}

        <div
          className="
            d-flex
            flex-wrap
            gap-3
            px-4
            pt-4
            pb-3
          "
        >

          {[
            [
              'Total devices',

              deployments.data?.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  (
                    item.totalTargets ||
                    0
                  ),
                0
              ) || 0,

              'neutral',
            ],

            [
              'Completed',

              deployments.data?.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  (
                    item.installedTargets ||
                    0
                  ),
                0
              ) || 0,

              'success',
            ],

            [
              'Installing',

              deployments.data?.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  (
                    item.installingTargets ||
                    0
                  ),
                0
              ) || 0,

              'warning',
            ],

            [
              'Waiting/Offline',

              deployments.data?.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  (
                    item.pendingTargets ||
                    0
                  ),
                0
              ) || 0,

              'neutral',
            ],

            [
              'Failed',

              deployments.data?.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  (
                    item.failedTargets ||
                    0
                  ),
                0
              ) || 0,

              'danger',
            ],

          ].map(
            ([
              label,
              value,
              tone,
            ]) => (

              <div
                key={label}
                className="hz-stat-chip"
              >

                <span
                  className={
                    `hz-status-dot hz-status-dot--${tone}`
                  }
                />

                <span>
                  {label}
                </span>

                <strong>
                  {value}
                </strong>

              </div>

            )
          )}

        </div>


        {/* ======================================================
            EXCEL-STYLE BOOTSTRAP TABLE
            ====================================================== */}

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
              align-middle
              mb-0
            "
            style={{
              fontSize: '12px',
              borderColor:
                '#d9e1e8',
              width: '100%',
            }}
          >

            {/* ==================================================
                TABLE HEADER
                ================================================== */}

            <thead>

              <tr>

                <th
                  scope="col"
                  className="
                    text-center
                    align-middle
                  "
                  style={{
                    height: 42,
                    backgroundColor:
                      '#0B2342',
                    color:
                      '#ffffff',
                    borderColor:
                      '#18385c',
                    fontWeight:
                      600,
                    fontSize: 12,
                    whiteSpace:
                      'nowrap',
                  }}
                >
                  Version
                </th>


                <th
                  scope="col"
                  className="
                    text-center
                    align-middle
                  "
                  style={{
                    height: 42,
                    backgroundColor:
                      '#0B2342',
                    color:
                      '#ffffff',
                    borderColor:
                      '#18385c',
                    fontWeight:
                      600,
                    fontSize: 12,
                    whiteSpace:
                      'nowrap',
                  }}
                >
                  Status
                </th>


                <th
                  scope="col"
                  className="
                    text-center
                    align-middle
                  "
                  style={{
                    height: 42,
                    backgroundColor:
                      '#0B2342',
                    color:
                      '#ffffff',
                    borderColor:
                      '#18385c',
                    fontWeight:
                      600,
                    fontSize: 12,
                    whiteSpace:
                      'nowrap',
                  }}
                >
                  Started
                </th>


                <th
                  scope="col"
                  className="
                    text-center
                    align-middle
                  "
                  style={{
                    height: 42,
                    backgroundColor:
                      '#0B2342',
                    color:
                      '#ffffff',
                    borderColor:
                      '#18385c',
                    fontWeight:
                      600,
                    fontSize: 12,
                    whiteSpace:
                      'nowrap',
                  }}
                >
                  Progress
                </th>


                <th
                  scope="col"
                  className="
                    text-center
                    align-middle
                  "
                  style={{
                    height: 42,
                    backgroundColor:
                      '#0B2342',
                    color:
                      '#ffffff',
                    borderColor:
                      '#18385c',
                    fontWeight:
                      600,
                    fontSize: 12,
                    whiteSpace:
                      'nowrap',
                  }}
                >
                  Note
                </th>


                <th
                  scope="col"
                  className="
                    text-center
                    align-middle
                  "
                  style={{
                    height: 42,
                    backgroundColor:
                      '#0B2342',
                    color:
                      '#ffffff',
                    borderColor:
                      '#18385c',
                    fontWeight:
                      600,
                    fontSize: 12,
                    whiteSpace:
                      'nowrap',
                  }}
                >
                  Action
                </th>

              </tr>

            </thead>


            {/* ==================================================
                TABLE BODY
                ================================================== */}

            <tbody>


              {/* LOADING */}

              {deployments.isLoading && (

                <tr>

                  <td
                    colSpan={6}
                    className="
                      text-center
                      align-middle
                      py-4
                    "
                  >

                    <div
                      className="
                        d-flex
                        justify-content-center
                        align-items-center
                        gap-2
                        text-secondary
                      "
                    >

                      <LoaderCircle
                        size={18}
                        className="spin"
                      />

                      Loading deployments...

                    </div>

                  </td>

                </tr>

              )}


              {/* ERROR */}

              {!deployments.isLoading &&
                deployments.isError && (

                  <tr>

                    <td
                      colSpan={6}
                      className="
                        text-center
                        align-middle
                        py-4
                        text-danger
                      "
                    >
                      Couldn't load deployment history.
                    </td>

                  </tr>

                )}


              {/* EMPTY */}

              {!deployments.isLoading &&
                !deployments.isError &&
                sortedDeployments.length ===
                  0 && (

                  <tr>

                    <td
                      colSpan={6}
                      className="
                        text-center
                        align-middle
                        py-5
                      "
                    >

                      <div
                        className="
                          d-flex
                          flex-column
                          align-items-center
                          gap-2
                        "
                      >

                        <Rocket
                          size={28}
                          className="
                            text-secondary
                          "
                        />

                        <strong>
                          No deployments yet
                        </strong>

                        <span
                          className="
                            text-secondary
                          "
                        >
                          Queued deployments will
                          appear here with their
                          current state.
                        </span>

                      </div>

                    </td>

                  </tr>

                )}


              {/* DATA */}

              {!deployments.isLoading &&
                !deployments.isError &&
                paginatedDeployments.map(
                  (
                    item
                  ) => (

                    <tr
                      key={
                        item.id
                      }
                    >

                      {/* VERSION */}

                      <td
                        className="
                          text-center
                          align-middle
                        "
                        style={{
                          height: 42,
                          borderColor:
                            '#d9e1e8',
                        }}
                      >

                        <span
                          className="
                            fw-semibold
                          "
                          style={{
                            color:
                              '#0B2342',
                          }}
                        >
                          {
                            item.softwareVersionId
                          }
                        </span>

                      </td>


                      {/* STATUS */}

                      <td
                        className="
                          text-center
                          align-middle
                        "
                        style={{
                          height: 42,
                          borderColor:
                            '#d9e1e8',
                        }}
                      >

                        <Badge
                          variant={
                            statusVariant(
                              item.status
                            )
                          }
                          dot
                        >
                          {
                            item.status
                          }
                        </Badge>

                      </td>


                      {/* STARTED */}

                      <td
                        className="
                          text-center
                          align-middle
                          text-nowrap
                        "
                        style={{
                          height: 42,
                          borderColor:
                            '#d9e1e8',
                        }}
                      >

                        {
                          item.startedAt
                            ? new Date(
                                item.startedAt
                              ).toLocaleString()
                            : '—'
                        }

                      </td>


                      {/* PROGRESS */}

                      <td
                        className="
                          text-center
                          align-middle
                        "
                        style={{
                          height: 42,
                          borderColor:
                            '#d9e1e8',
                        }}
                      >

                        <span
                          className="
                            fw-semibold
                            text-nowrap
                          "
                        >

                          {
                            item.installedTargets ||
                            0
                          }

                          /

                          {
                            item.totalTargets ||
                            0
                          }

                          {' '}
                          installed

                        </span>

                      </td>


                      {/* NOTE */}

                      <td
                        className="
                          align-middle
                        "
                        style={{
                          height: 42,
                          maxWidth: 320,
                          borderColor:
                            '#d9e1e8',
                        }}
                      >

                        <span
                          className="
                            text-truncate
                            d-block
                          "
                          style={{
                            maxWidth: 300,
                          }}
                          title={
                            item.note ||
                            ''
                          }
                        >
                          {
                            item.note ||
                            '—'
                          }
                        </span>

                      </td>


                      {/* ACTION */}

                      <td
                        className="
                          text-center
                          align-middle
                        "
                        style={{
                          height: 42,
                          borderColor:
                            '#d9e1e8',
                        }}
                      >

                        <Button
                          variant="secondary"
                          icon={Eye}
                          onClick={() =>
                            setSelectedDeploymentId(
                              item.id
                            )
                          }
                          aria-label="View deployment targets"
                        />

                      </td>

                    </tr>

                  )
                )}

            </tbody>

          </table>

        </div>


        {/* ======================================================
            PAGINATION
            ====================================================== */}

        {sortedDeployments.length > 0 && (

          <div
            className="
              d-flex
              align-items-center
              justify-content-between
              flex-wrap
              gap-2
              px-3
              py-2
              border-top
            "
            style={{
              backgroundColor:
                '#f8fafc',
              minHeight: 52,
            }}
          >

            {/* RECORD COUNT */}

            <div
              className="
                text-secondary
              "
              style={{
                fontSize: 12,
              }}
            >

              Showing{' '}

              <strong>
                {deploymentStartIndex}
              </strong>

              {' - '}

              <strong>
                {deploymentEndIndex}
              </strong>

              {' of '}

              <strong>
                {sortedDeployments.length}
              </strong>

              {' deployments'}

            </div>


            {/* PAGE BUTTONS */}

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
                  btn-outline-secondary
                "
                disabled={
                  safeDeploymentPage ===
                  1
                }
                onClick={() =>
                  goToDeploymentPage(
                    safeDeploymentPage -
                      1
                  )
                }
                style={{
                  fontSize: 12,
                  height: 30,
                }}
              >
                Previous
              </button>


              {/* PAGE NUMBERS */}

              {Array.from(
                {
                  length:
                    totalDeploymentPages,
                },
                (
                  _,
                  index
                ) =>
                  index + 1
              ).map(
                (page) => (

                  <button
                    key={
                      page
                    }
                    type="button"
                    className="
                      btn
                      btn-sm
                    "
                    onClick={() =>
                      goToDeploymentPage(
                        page
                      )
                    }
                    style={{
                      minWidth: 32,
                      height: 30,

                      backgroundColor:
                        safeDeploymentPage ===
                        page
                          ? '#0B2342'
                          : '#ffffff',

                      color:
                        safeDeploymentPage ===
                        page
                          ? '#ffffff'
                          : '#334155',

                      border:
                        safeDeploymentPage ===
                        page
                          ? '1px solid #0B2342'
                          : '1px solid #cbd5e1',

                      fontWeight:
                        safeDeploymentPage ===
                        page
                          ? 600
                          : 500,

                      fontSize: 12,
                    }}
                  >
                    {page}
                  </button>

                )
              )}


              {/* NEXT */}

              <button
                type="button"
                className="
                  btn
                  btn-sm
                  btn-outline-secondary
                "
                disabled={
                  safeDeploymentPage ===
                  totalDeploymentPages
                }
                onClick={() =>
                  goToDeploymentPage(
                    safeDeploymentPage +
                      1
                  )
                }
                style={{
                  fontSize: 12,
                  height: 30,
                }}
              >
                Next
              </button>

            </div>

          </div>

        )}

      </Card>


      {/* ========================================================
          DEPLOYMENT TARGETS
          ======================================================== */}

      {selectedDeploymentId && (

        <Card
          title="Deployment targets"
          icon={Eye}
        >

          <div
            className="
              table-responsive
            "
          >

            <Table
              columns={[

                {
                  key: 'employee',

                  label: 'Employee',

                  render: (
                    item
                  ) =>
                    item.employeeName ||
                    'Unassigned',
                },


                {
                  key: 'device',

                  label: 'Device',

                  render: (
                    item
                  ) =>
                    item.deviceName,
                },


                {
                  key: 'status',

                  label: 'Current stage',

                  render: (
                    item
                  ) => (

                    <Badge
                      variant={
                        statusVariant(
                          item.status
                        )
                      }
                      dot
                    >

                      {
                        TIMELINE_STAGES.find(
                          (
                            stage
                          ) =>
                            stage.key ===
                            item.status
                        )?.label ||
                        item.status
                      }

                    </Badge>

                  ),
                },


                {
                  key: 'progress',

                  label: 'Timeline',

                  render: (
                    item
                  ) => (

                    <span>

                      {
                        buildTimeline(
                          item
                        ).filter(
                          (
                            stage
                          ) =>
                            stage.state ===
                            'completed'
                        ).length
                      }

                      /

                      {
                        TIMELINE_STAGES.length
                      }

                      {' '}
                      stages

                    </span>

                  ),
                },


                {
                  key: 'error',

                  label: 'Failure',

                  render: (
                    item
                  ) =>
                    item.errorMessage ||
                    item.stages?.find(
                      (
                        stage
                      ) =>
                        stage.status ===
                        'FAILED'
                    )?.errorMessage ||
                    '—',
                },


                {
                  key: 'actions',

                  label: 'Action',

                  render: (
                    item
                  ) => (

                    <Button
                      variant="secondary"
                      icon={Eye}
                      onClick={() =>
                        setSelectedTarget(
                          item
                        )
                      }
                      aria-label={
                        `View ${item.deviceName} deployment timeline`
                      }
                    />

                  ),
                },

              ]}

              rows={
                deploymentTargets.data ||
                []
              }

              getRowKey={
                (item) =>
                  item.id
              }

              isLoading={
                deploymentTargets.isLoading
              }

              isError={
                deploymentTargets.isError
              }

              onRetry={
                deploymentTargets.refetch
              }

              emptyTitle={
                "No target status yet"
              }

              emptyDescription={
                "Target status will appear after the deployment is queued."
              }

            />

          </div>

        </Card>

      )}


      {/* ========================================================
          TIMELINE DIALOG
          ======================================================== */}

      <Dialog

        open={
          Boolean(
            selectedTarget
          )
        }

        onClose={() =>
          setSelectedTarget(
            null
          )
        }

        title={
          selectedTarget
            ? `${selectedTarget.deviceName} deployment timeline`
            : 'Deployment timeline'
        }

        description={
          selectedTarget?.employeeName ||
          'Device execution details'
        }

        size="md"
      >

        {selectedTarget && (

          <div
            className="
              d-flex
              flex-column
              gap-3
            "
          >

            {
              buildTimeline(
                selectedTarget
              ).map(
                (stage) => (

                  <div
                    key={
                      stage.key
                    }
                    className={
                      `deployment-stage deployment-stage--${stage.state}`
                    }
                  >

                    <div
                      className="
                        deployment-stage__icon
                      "
                    >

                      <StageIcon
                        state={
                          stage.state
                        }
                      />

                    </div>


                    <div
                      className="
                        flex-grow-1
                      "
                    >

                      <div
                        className="
                          d-flex
                          justify-content-between
                          gap-3
                        "
                      >

                        <strong>
                          {stage.label}
                        </strong>


                        <small>
                          {
                            stage.event?.occurredAt
                              ? new Date(
                                  stage.event.occurredAt
                                ).toLocaleString()
                              : ''
                          }
                        </small>

                      </div>


                      {stage.state ===
                        'failed' && (

                        <div
                          className="
                            small
                            mt-1
                          "
                        >

                          <strong>
                            Failure:
                          </strong>

                          {' '}

                          {
                            stage.event
                              ?.errorMessage ||
                            'Deployment failed'
                          }

                          {
                            stage.event
                              ?.errorCode && (

                            <span>
                              {' '}
                              (
                              {
                                stage.event
                                  .errorCode
                              }
                              )
                            </span>

                          )}

                        </div>

                      )}

                    </div>

                  </div>

                )
              )
            }


            {selectedTarget.installedVersion && (

              <div
                className="
                  text-secondary-hz
                  small
                "
              >

                Installed version:{' '}

                {
                  selectedTarget.installedVersion
                }

              </div>

            )}

          </div>

        )}

      </Dialog>

    </div>
  );
}