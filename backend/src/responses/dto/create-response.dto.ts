import { IsUUID, IsObject, IsNotEmpty } from 'class-validator';

export class CreateResponseDto {
  @IsUUID()
  formId: string;

  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;
}
