import { Controller, Get, Header, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser, Permissions, type AuthenticatedActor, type AuthenticatedRequest } from '../../common/decorators/auth.decorators';
import { ReportFilters, ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @Permissions('report.view')
  summary(@CurrentUser() actor: AuthenticatedActor, @Req() req: AuthenticatedRequest, @Query() query: ReportFilters) {
    return this.reports.summary({
      ...toContext(actor, req),
    }, query);
  }

  @Get('exports/registrations.csv')
  @Permissions('report.view')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="darbel-registrations.csv"')
  async registrationsCsv(
    @CurrentUser() actor: AuthenticatedActor,
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportFilters,
    @Res({ passthrough: true }) _res: Response,
  ) {
    return this.reports.registrationsCsv(toContext(actor, req), query);
  }

  @Get('exports/certificates.csv')
  @Permissions('report.view')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="darbel-certificates.csv"')
  async certificatesCsv(
    @CurrentUser() actor: AuthenticatedActor,
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportFilters,
    @Res({ passthrough: true }) _res: Response,
  ) {
    return this.reports.certificatesCsv(toContext(actor, req), query);
  }

  @Get('exports/medical-screenings.csv')
  @Permissions('report.view')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="darbel-medical-screenings.csv"')
  async medicalScreeningsCsv(
    @CurrentUser() actor: AuthenticatedActor,
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportFilters,
    @Res({ passthrough: true }) _res: Response,
  ) {
    return this.reports.medicalScreeningsCsv(toContext(actor, req), query);
  }

  @Get('exports/registrations.xls')
  @Permissions('report.view')
  @Header('content-type', 'application/vnd.ms-excel; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="darbel-registrations.xls"')
  async registrationsXls(
    @CurrentUser() actor: AuthenticatedActor,
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportFilters,
    @Res({ passthrough: true }) _res: Response,
  ) {
    return this.reports.registrationsXls(toContext(actor, req), query);
  }

  @Get('exports/certificates.xls')
  @Permissions('report.view')
  @Header('content-type', 'application/vnd.ms-excel; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="darbel-certificates.xls"')
  async certificatesXls(
    @CurrentUser() actor: AuthenticatedActor,
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportFilters,
    @Res({ passthrough: true }) _res: Response,
  ) {
    return this.reports.certificatesXls(toContext(actor, req), query);
  }

  @Get('exports/medical-screenings.xls')
  @Permissions('report.view')
  @Header('content-type', 'application/vnd.ms-excel; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="darbel-medical-screenings.xls"')
  async medicalScreeningsXls(
    @CurrentUser() actor: AuthenticatedActor,
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportFilters,
    @Res({ passthrough: true }) _res: Response,
  ) {
    return this.reports.medicalScreeningsXls(toContext(actor, req), query);
  }

  @Get('exports/summary.pdf')
  @Permissions('report.view')
  async summaryPdf(
    @CurrentUser() actor: AuthenticatedActor,
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportFilters,
    @Res() res: Response,
  ) {
    return sendPdf(res, await this.reports.summaryPdf(toContext(actor, req), query), 'darbel-compliance-summary.pdf');
  }

  @Get('exports/registrations.pdf')
  @Permissions('report.view')
  async registrationsPdf(
    @CurrentUser() actor: AuthenticatedActor,
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportFilters,
    @Res() res: Response,
  ) {
    return sendPdf(res, await this.reports.registrationsPdf(toContext(actor, req), query), 'darbel-registrations.pdf');
  }

  @Get('exports/certificates.pdf')
  @Permissions('report.view')
  async certificatesPdf(
    @CurrentUser() actor: AuthenticatedActor,
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportFilters,
    @Res() res: Response,
  ) {
    return sendPdf(res, await this.reports.certificatesPdf(toContext(actor, req), query), 'darbel-certificates.pdf');
  }

  @Get('exports/medical-screenings.pdf')
  @Permissions('report.view')
  async medicalScreeningsPdf(
    @CurrentUser() actor: AuthenticatedActor,
    @Req() req: AuthenticatedRequest,
    @Query() query: ReportFilters,
    @Res() res: Response,
  ) {
    return sendPdf(res, await this.reports.medicalScreeningsPdf(toContext(actor, req), query), 'darbel-medical-screenings.pdf');
  }
}

function sendPdf(res: Response, body: Buffer, filename: string) {
  res.setHeader('content-type', 'application/pdf');
  res.setHeader('content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('content-length', String(body.length));
  return res.send(body);
}

function toContext(actor: AuthenticatedActor, req: AuthenticatedRequest) {
  return {
    userId: actor.userId,
    tenantId: actor.tenantId,
    userEmail: actor.email,
    requestId: req.requestId!,
    clientIp: req.ip,
    userAgent: req.header('user-agent'),
  };
}
