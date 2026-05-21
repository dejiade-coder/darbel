import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Use Zod schemas as runtime validators and TypeScript types simultaneously.
 *
 * Usage:
 *   const LoginDto = z.object({ email: z.string().email(), password: z.string() });
 *   type LoginDto = z.infer<typeof LoginDto>;
 *
 *   @Post('login')
 *   login(@Body(new ZodValidationPipe(LoginDto)) dto: LoginDto) { ... }
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const flat = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      throw new BadRequestException({
        message: flat,
        error: 'Validation failed',
        statusCode: 400,
      });
    }
    return result.data;
  }
}
